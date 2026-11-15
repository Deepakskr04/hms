import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOpenClawKey } from "@/lib/openclaw-auth";
import { RoomStatus } from "@/types/enums";
import { calculateStayUnitsAndBill } from "@/lib/booking-utils";
import { safeRevalidatePath } from "@/lib/safe-revalidate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = verifyOpenClawKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      roomNumber,
      finalAgreedTotal,
      amountCollectedNow,
      paymentMode = "CASH",
      cashAmount = 0,
      upiAmount = 0,
      markRoomClean = false,
      notes,
    } = body;

    if (!roomNumber) {
      return NextResponse.json(
        { success: false, error: "roomNumber is required." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find Room and Active Booking
      const room = await tx.room.findUnique({
        where: { roomNumber: String(roomNumber).trim() },
        include: {
          bookings: {
            where: { status: "ACTIVE" },
            include: { guest: true, payments: true },
            take: 1,
          },
        },
      });

      if (!room) {
        throw new Error(`Room ${roomNumber} not found.`);
      }

      if (room.bookings.length === 0) {
        throw new Error(`Room ${roomNumber} does not have an active booking to check out.`);
      }

      const booking = room.bookings[0];
      const now = new Date();
      const metrics = calculateStayUnitsAndBill(booking, now);

      // Determine final total
      const finalBill =
        finalAgreedTotal !== undefined
          ? Math.max(0, Math.round(Number(finalAgreedTotal)))
          : metrics.calculatedTotal;

      const currentPaid = booking.totalPaid;
      const balanceDue = Math.max(0, finalBill - currentPaid);

      // Amount to settle now: if amountCollectedNow is specified, use that; otherwise use balanceDue
      const collectAmount =
        amountCollectedNow !== undefined
          ? Math.max(0, Math.round(Number(amountCollectedNow)))
          : balanceDue;

      // Validate split payment
      if (paymentMode === "SPLIT" && collectAmount > 0) {
        const splitSum = (Number(cashAmount) || 0) + (Number(upiAmount) || 0);
        if (splitSum !== collectAmount) {
          throw new Error(
            `Split amounts (₹${cashAmount} + ₹${upiAmount}) must match settlement amount (₹${collectAmount}).`
          );
        }
      }

      // Record Settlement Payment if collectAmount > 0
      if (collectAmount > 0) {
        if (paymentMode === "CASH") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: collectAmount,
              paymentMode: "CASH",
              paymentType: "CHECKOUT_SETTLEMENT",
              notes: notes || "Checkout settlement (Cash) via OpenClaw",
            },
          });
        } else if (paymentMode === "UPI") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: collectAmount,
              paymentMode: "UPI",
              paymentType: "CHECKOUT_SETTLEMENT",
              notes: notes || "Checkout settlement (UPI) via OpenClaw",
            },
          });
        } else if (paymentMode === "SPLIT") {
          const c = Number(cashAmount) || 0;
          const u = Number(upiAmount) || 0;
          if (c > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: c,
                paymentMode: "CASH",
                paymentType: "CHECKOUT_SETTLEMENT",
                notes: notes || "Checkout settlement split (Cash) via OpenClaw",
              },
            });
          }
          if (u > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: u,
                paymentMode: "UPI",
                paymentType: "CHECKOUT_SETTLEMENT",
                notes: notes || "Checkout settlement split (UPI) via OpenClaw",
              },
            });
          }
        }
      }

      const newTotalPaid = currentPaid + collectAmount;

      // Update Booking
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          finalTotal: finalBill,
          totalPaid: newTotalPaid,
          status: "COMPLETED",
          actualCheckOut: now,
        },
      });

      // Check open blocking maintenance issue
      const openBlockingIssue = await tx.hotelIssue.findFirst({
        where: {
          roomId: room.id,
          status: "OPEN",
          blockRoom: true,
        },
      });

      let nextStatus: string = RoomStatus.NEEDS_CLEANING;
      if (openBlockingIssue) {
        nextStatus = RoomStatus.MAINTENANCE;
      } else if (markRoomClean === true) {
        nextStatus = RoomStatus.AVAILABLE;
      }

      await tx.room.update({
        where: { id: room.id },
        data: { status: nextStatus },
      });

      return {
        bookingId: updatedBooking.id,
        roomNumber: room.roomNumber,
        guestName: booking.guest.fullName,
        stayType: booking.stayType,
        daysStayed: metrics.elapsedUnits,
        agreedRate: booking.agreedRate,
        finalTotal: finalBill,
        previouslyPaid: currentPaid,
        settlementCollected: collectAmount,
        totalPaid: newTotalPaid,
        paymentMode: collectAmount > 0 ? paymentMode : "NONE",
        roomStatus: nextStatus,
      };
    });

    safeRevalidatePath("/");
    safeRevalidatePath("/bookings");
    safeRevalidatePath("/finance");

    return NextResponse.json({
      success: true,
      message: `Room ${result.roomNumber} (${result.guestName}) settled and checked out. Room is now ${result.roomStatus}.`,
      settlement: result,
    });
  } catch (error) {
    console.error("Error in POST /api/openclaw/checkout:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to checkout room",
      },
      { status: 400 }
    );
  }
}
