import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOpenClawKey } from "@/lib/openclaw-auth";
import { RoomMode, RoomStatus } from "@/types/enums";
import { toTwelvePM } from "@/lib/date-utils";
import { normalizePhone } from "@/lib/phone-utils";
import { safeRevalidatePath } from "@/lib/safe-revalidate";

export async function POST(req: NextRequest) {
  const authError = verifyOpenClawKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      roomNumber,
      guestName,
      phone,
      stayType = "DAILY",
      checkInDate, // optional YYYY-MM-DD string, defaults to today
      expectedCheckOut, // optional ISO string / YYYY-MM-DD or null
      agreedRate,
      advancePaid = 0,
      paymentMode = "CASH",
      cashAmount = 0,
      upiAmount = 0,
      source = "WALK_IN",
      notes,
    } = body;

    if (!roomNumber) {
      return NextResponse.json(
        { success: false, error: "roomNumber is required." },
        { status: 400 }
      );
    }

    if (!guestName || !guestName.trim()) {
      return NextResponse.json(
        { success: false, error: "guestName is required." },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: "Valid 10-digit phone number is required." },
        { status: 400 }
      );
    }

    if (!agreedRate || Number(agreedRate) <= 0) {
      return NextResponse.json(
        { success: false, error: "agreedRate must be greater than zero." },
        { status: 400 }
      );
    }

    const numAdvance = Math.max(0, Number(advancePaid) || 0);

    if (paymentMode === "SPLIT" && numAdvance > 0) {
      const splitSum = (Number(cashAmount) || 0) + (Number(upiAmount) || 0);
      if (splitSum !== numAdvance) {
        return NextResponse.json(
          {
            success: false,
            error: `Split amounts (₹${cashAmount} + ₹${upiAmount}) must match advance paid (₹${numAdvance}).`,
          },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find Room
      const room = await tx.room.findUnique({
        where: { roomNumber: String(roomNumber).trim() },
      });

      if (!room) {
        throw new Error(`Room ${roomNumber} does not exist in inventory.`);
      }

      // Guard: Locked rooms
      if (
        room.mode === RoomMode.PERSONAL ||
        room.mode === "PERSONAL" ||
        room.mode === RoomMode.STORE_ROOM ||
        room.mode === "STORE_ROOM"
      ) {
        throw new Error(`Room ${room.roomNumber} is locked (${room.mode}) and permanently non-bookable.`);
      }

      // Guard: Dirty / Maintenance / Occupied
      if (room.status === RoomStatus.OCCUPIED || room.status === "OCCUPIED") {
        throw new Error(`Room ${room.roomNumber} is currently OCCUPIED.`);
      }
      if (room.status === RoomStatus.NEEDS_CLEANING || room.status === "NEEDS_CLEANING") {
        throw new Error(`Room ${room.roomNumber} is marked as NEEDS_CLEANING. Please clean room first.`);
      }
      if (room.status === RoomStatus.MAINTENANCE || room.status === "MAINTENANCE") {
        throw new Error(`Room ${room.roomNumber} is under MAINTENANCE.`);
      }

      // Check-In and Check-Out dates
      const now = new Date();
      const checkIn = checkInDate ? toTwelvePM(checkInDate) : toTwelvePM(now);

      let parsedExpectedCheckOut: Date | null = null;
      if (expectedCheckOut) {
        parsedExpectedCheckOut = toTwelvePM(expectedCheckOut);
        if (parsedExpectedCheckOut <= checkIn) {
          throw new Error("expectedCheckOut date must be after checkIn date.");
        }
      }

      // Check open-ended collision
      const openEndedActive = await tx.booking.findFirst({
        where: {
          roomId: room.id,
          status: "ACTIVE",
          expectedCheckOut: null,
        },
      });

      if (openEndedActive) {
        throw new Error(`Room ${room.roomNumber} already has an active open-ended stay.`);
      }

      // 2. Upsert Guest
      let guest = await tx.guest.findUnique({
        where: { phone: cleanPhone },
      });

      if (guest) {
        guest = await tx.guest.update({
          where: { phone: cleanPhone },
          data: {
            fullName: guestName.trim() || guest.fullName,
            notes: notes ? `${guest.notes || ""}; ${notes}` : guest.notes,
          },
        });
      } else {
        guest = await tx.guest.create({
          data: {
            fullName: guestName.trim(),
            phone: cleanPhone,
            idProofType: "AADHAAR",
            idProofNo: "ON_FILE",
            notes: notes || null,
          },
        });
      }

      // 3. Create Booking
      const booking = await tx.booking.create({
        data: {
          roomId: room.id,
          guestId: guest.id,
          source: source === "PHONE_CALL" ? "PHONE_CALL" : "WALK_IN",
          stayType: stayType === "MONTHLY" ? "MONTHLY" : "DAILY",
          checkIn,
          expectedCheckOut: parsedExpectedCheckOut,
          agreedRate: Math.round(Number(agreedRate)),
          totalPaid: numAdvance,
          status: "ACTIVE",
          createdBy: "OPENCLAW",
          notes: notes || "Checked in via OpenClaw API",
        },
      });

      // 4. Record Initial Payment
      if (numAdvance > 0) {
        if (paymentMode === "CASH") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: numAdvance,
              paymentMode: "CASH",
              paymentType: "ADVANCE",
              notes: "Advance paid (Cash) via OpenClaw",
            },
          });
        } else if (paymentMode === "UPI") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: numAdvance,
              paymentMode: "UPI",
              paymentType: "ADVANCE",
              notes: "Advance paid (UPI) via OpenClaw",
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
                paymentType: "ADVANCE",
                notes: "Advance split (Cash) via OpenClaw",
              },
            });
          }
          if (u > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: u,
                paymentMode: "UPI",
                paymentType: "ADVANCE",
                notes: "Advance split (UPI) via OpenClaw",
              },
            });
          }
        }
      }

      // 5. Update room status to OCCUPIED
      await tx.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.OCCUPIED },
      });

      return {
        bookingId: booking.id,
        roomNumber: room.roomNumber,
        guestName: guest.fullName,
        phone: guest.phone,
        stayType: booking.stayType,
        checkIn: booking.checkIn.toISOString(),
        expectedCheckOut: booking.expectedCheckOut ? booking.expectedCheckOut.toISOString() : null,
        agreedRate: booking.agreedRate,
        advancePaid: booking.totalPaid,
      };
    });

    safeRevalidatePath("/");
    safeRevalidatePath("/bookings");
    safeRevalidatePath("/finance");

    return NextResponse.json({
      success: true,
      message: `Successfully booked Room ${result.roomNumber} for ${result.guestName} via OpenClaw.`,
      booking: result,
    });
  } catch (error) {
    console.error("Error in POST /api/openclaw/bookings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create booking",
      },
      { status: 400 }
    );
  }
}
