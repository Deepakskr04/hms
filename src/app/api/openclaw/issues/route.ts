import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOpenClawKey } from "@/lib/openclaw-auth";
import { RoomStatus } from "@/types/enums";
import { safeRevalidatePath } from "@/lib/safe-revalidate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = verifyOpenClawKey(req);
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "OPEN";

    const issues = await prisma.hotelIssue.findMany({
      where: status === "ALL" ? undefined : { status },
      include: { room: { select: { roomNumber: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, count: issues.length, issues });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch issues" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authError = verifyOpenClawKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      roomNumber,
      title,
      priority = "NORMAL",
      blockRoom = false,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "title is required." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let roomId: string | null = null;
      let room = null;

      if (roomNumber) {
        room = await tx.room.findUnique({
          where: { roomNumber: String(roomNumber).trim() },
        });

        if (!room) {
          throw new Error(`Room ${roomNumber} not found.`);
        }
        roomId = room.id;
      }

      const issue = await tx.hotelIssue.create({
        data: {
          roomId,
          title: title.trim(),
          priority: priority === "URGENT" ? "URGENT" : "NORMAL",
          status: "OPEN",
          blockRoom: Boolean(blockRoom),
          loggedBy: "OPENCLAW",
        },
      });

      // If issue blocks room and room is currently AVAILABLE or NEEDS_CLEANING, mark MAINTENANCE
      // (If OCCUPIED, domain rule keeps OCCUPIED until checkout)
      if (room && blockRoom && (room.status === RoomStatus.AVAILABLE || room.status === RoomStatus.NEEDS_CLEANING)) {
        await tx.room.update({
          where: { id: room.id },
          data: { status: RoomStatus.MAINTENANCE },
        });
      }

      return {
        id: issue.id,
        roomNumber: room?.roomNumber || null,
        title: issue.title,
        priority: issue.priority,
        blockRoom: issue.blockRoom,
        status: issue.status,
        loggedBy: issue.loggedBy,
        createdAt: issue.createdAt.toISOString(),
      };
    });

    safeRevalidatePath("/issues");
    safeRevalidatePath("/");

    return NextResponse.json({
      success: true,
      message: `Issue "${result.title}" created successfully${result.roomNumber ? ` for Room ${result.roomNumber}` : ""}.`,
      issue: result,
    });
  } catch (error) {
    console.error("Error in POST /api/openclaw/issues:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create issue",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const authError = verifyOpenClawKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      id,
      roomNumber,
      repairCost = 0,
      paymentMode = "CASH",
      notes,
    } = body;

    if (!id && !roomNumber) {
      return NextResponse.json(
        { success: false, error: "Either issue 'id' or 'roomNumber' is required to resolve an issue." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let issue;

      if (id) {
        issue = await tx.hotelIssue.findUnique({
          where: { id },
          include: { room: true },
        });
      } else if (roomNumber) {
        const room = await tx.room.findUnique({
          where: { roomNumber: String(roomNumber).trim() },
        });
        if (!room) {
          throw new Error(`Room ${roomNumber} not found.`);
        }
        issue = await tx.hotelIssue.findFirst({
          where: { roomId: room.id, status: "OPEN" },
          include: { room: true },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!issue) {
        throw new Error("No open issue found matching criteria.");
      }

      const now = new Date();

      // Resolve Issue
      const updatedIssue = await tx.hotelIssue.update({
        where: { id: issue.id },
        data: {
          status: "RESOLVED",
          resolvedAt: now,
        },
      });

      // Optional Auto-Log Repair Expense
      let loggedExpense = null;
      const cost = Math.max(0, Math.round(Number(repairCost) || 0));

      if (cost > 0) {
        loggedExpense = await tx.expense.create({
          data: {
            title: `Repair: ${issue.title}${issue.room ? ` (Room ${issue.room.roomNumber})` : ""}`,
            category: "MAINTENANCE",
            amount: cost,
            paymentMode: paymentMode === "UPI" ? "UPI" : "CASH",
            loggedBy: "OPENCLAW",
            expenseDate: now,
            notes: notes || `Auto-logged from issue resolution (${issue.id})`,
          },
        });
      }

      // If room was blocked, check if any other open blocking issue remains
      if (issue.roomId && issue.room && issue.room.status === RoomStatus.MAINTENANCE) {
        const remainingBlocking = await tx.hotelIssue.findFirst({
          where: {
            roomId: issue.roomId,
            id: { not: issue.id },
            status: "OPEN",
            blockRoom: true,
          },
        });

        if (!remainingBlocking) {
          await tx.room.update({
            where: { id: issue.roomId },
            data: { status: RoomStatus.AVAILABLE },
          });
        }
      }

      return {
        issue: {
          id: updatedIssue.id,
          title: updatedIssue.title,
          status: updatedIssue.status,
          resolvedAt: updatedIssue.resolvedAt?.toISOString(),
        },
        expense: loggedExpense
          ? {
              id: loggedExpense.id,
              title: loggedExpense.title,
              amount: loggedExpense.amount,
              paymentMode: loggedExpense.paymentMode,
            }
          : null,
      };
    });

    safeRevalidatePath("/issues");
    safeRevalidatePath("/finance");
    safeRevalidatePath("/");

    return NextResponse.json({
      success: true,
      message: `Issue "${result.issue.title}" resolved successfully.${result.expense ? ` Recorded repair expense of ₹${result.expense.amount}.` : ""}`,
      ...result,
    });
  } catch (error) {
    console.error("Error in PATCH /api/openclaw/issues:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to resolve issue",
      },
      { status: 400 }
    );
  }
}
