"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentRole } from "@/lib/auth";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { RoomStatus } from "@/types/enums";

export interface ExpenseInput {
  title: string;
  category: "MAINTENANCE" | "UTILITIES" | "SUPPLIES" | "STAFF" | "OTHER";
  amount: number;
  paymentMode: "CASH" | "UPI";
  expenseDate?: Date | string;
  notes?: string;
}

export interface HotelIssueInput {
  roomId?: string;
  title: string;
  priority: "NORMAL" | "URGENT";
  blockRoom: boolean;
  notes?: string;
}

export interface ResolveIssueInput {
  issueId: string;
  logExpense?: boolean;
  expenseTitle?: string;
  expenseAmount?: number;
  repairCost?: number; // alias for expenseAmount
  paymentMode?: "CASH" | "UPI";
}

/**
 * Create a new expense entry
 */
export async function createExpense(data: ExpenseInput) {
  try {
    const role = (await getCurrentRole()) || "ADMIN";

    const expense = await prisma.expense.create({
      data: {
        title: data.title,
        category: data.category,
        amount: Math.round(Number(data.amount)),
        paymentMode: data.paymentMode,
        loggedBy: role,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        notes: data.notes || null,
      },
    });

    safeRevalidatePath("/finance");
    safeRevalidatePath("/");
    return { success: true, expense };
  } catch (error) {
    console.error("Error creating expense:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record expense",
    };
  }
}

/**
 * Delete an expense entry
 */
export async function deleteExpense(expenseId: string) {
  try {
    await prisma.expense.delete({
      where: { id: expenseId },
    });

    safeRevalidatePath("/finance");
    safeRevalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting expense:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete expense",
    };
  }
}

/**
 * Fetch expenses filtered by date or month
 */
export async function getExpenses(monthString?: string) {
  try {
    let dateFilter = {};
    if (monthString) {
      // monthString format: "YYYY-MM"
      const [year, month] = monthString.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter = {
        expenseDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      };
    }

    const expenses = await prisma.expense.findMany({
      where: dateFilter,
      orderBy: { expenseDate: "desc" },
    });

    return { success: true, expenses };
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return { success: false, expenses: [], error: "Failed to fetch expenses" };
  }
}

/**
 * Log a new hotel issue.
 * Invariant 9: If blockRoom is true and room is NOT occupied, sets Room.status = MAINTENANCE.
 * If room IS currently OCCUPIED, keeps it OCCUPIED so guest stay is uninterrupted;
 * it transitions to MAINTENANCE when guest checks out.
 */
export async function createHotelIssue(data: HotelIssueInput) {
  try {
    const role = (await getCurrentRole()) || "ADMIN";

    const issue = await prisma.$transaction(async (tx) => {
      const newIssue = await tx.hotelIssue.create({
        data: {
          title: data.title,
          priority: data.priority,
          status: "OPEN",
          blockRoom: data.blockRoom,
          roomId: data.roomId || null,
          loggedBy: role,
        },
      });

      if (data.blockRoom && data.roomId) {
        const room = await tx.room.findUnique({ where: { id: data.roomId } });
        // Only flip to MAINTENANCE immediately if room is not currently OCCUPIED
        if (room && room.status !== RoomStatus.OCCUPIED && room.status !== "OCCUPIED") {
          await tx.room.update({
            where: { id: data.roomId },
            data: { status: RoomStatus.MAINTENANCE },
          });
        }
      }

      return newIssue;
    });

    safeRevalidatePath("/issues");
    safeRevalidatePath("/");
    return { success: true, issue };
  } catch (error) {
    console.error("Error creating hotel issue:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to report issue",
    };
  }
}

/**
 * Resolve an issue. If it blocked a room, return room to AVAILABLE.
 * Optionally log an accompanying repair expense atomically (Invariant 10).
 */
export async function resolveHotelIssue(data: ResolveIssueInput) {
  try {
    const role = (await getCurrentRole()) || "ADMIN";

    await prisma.$transaction(async (tx) => {
      const issue = await tx.hotelIssue.findUnique({
        where: { id: data.issueId },
      });

      if (!issue) {
        throw new Error("Issue not found");
      }

      // Mark issue resolved
      await tx.hotelIssue.update({
        where: { id: data.issueId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });

      // If room was blocked, restore it to AVAILABLE
      if (issue.blockRoom && issue.roomId) {
        await tx.room.update({
          where: { id: issue.roomId },
          data: { status: RoomStatus.AVAILABLE },
        });
      }

      // Support either repairCost or expenseAmount
      const cost = data.repairCost ?? data.expenseAmount ?? 0;
      const shouldLog = Boolean(data.logExpense || cost > 0);

      if (shouldLog && cost > 0) {
        const title = data.expenseTitle || `Repair: ${issue.title}`;
        await tx.expense.create({
          data: {
            title,
            category: "MAINTENANCE",
            amount: Math.round(Number(cost)),
            paymentMode: data.paymentMode || "CASH",
            loggedBy: role,
            expenseDate: new Date(),
            notes: `Resolved Issue: ${issue.title}`,
          },
        });
      }
    });

    safeRevalidatePath("/issues");
    safeRevalidatePath("/");
    safeRevalidatePath("/finance");
    return { success: true };
  } catch (error) {
    console.error("Error resolving hotel issue:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resolve issue",
    };
  }
}

/**
 * Fetch all issues
 */
export async function getHotelIssues() {
  try {
    const issues = await prisma.hotelIssue.findMany({
      include: {
        room: true,
      },
      orderBy: [
        { status: "asc" }, // "OPEN" before "RESOLVED"
        { createdAt: "desc" },
      ],
    });
    return { success: true, issues };
  } catch (error) {
    console.error("Error fetching issues:", error);
    return { success: false, issues: [], error: "Failed to load issues" };
  }
}
