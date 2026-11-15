"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentRole } from "@/lib/auth";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { RoomMode, RoomStatus } from "@/types/enums";
import { toTwelvePM } from "@/lib/date-utils";
import { normalizePhone } from "@/lib/phone-utils";
import { calculateStayUnitsAndBill } from "@/lib/booking-utils";

export interface CreateBookingInput {
  roomId: string;
  fullName: string;
  phone: string;
  idProofType?: string;
  idProofNo?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  guestNotes?: string;
  source: "WALK_IN" | "PHONE_CALL";
  stayType?: "DAILY" | "MONTHLY";
  checkInDate: string; // "YYYY-MM-DD"
  expectedCheckOutDate?: string | null; // Optional/open-ended
  daysCount?: number;
  guestsCount?: number;
  agreedRate: number;
  totalAmount?: number;
  advancePaid: number;
  paymentMode: "CASH" | "UPI" | "SPLIT";
  cashAmount?: number;
  upiAmount?: number;
  bookingNotes?: string;
}

export interface ExtendBookingInput {
  bookingId: string;
  additionalDays?: number;
  newExpectedCheckOutDate?: string;
  additionalAmount?: number;
  paymentMode?: "CASH" | "UPI" | "SPLIT";
  cashAmount?: number;
  upiAmount?: number;
}

export interface RecordPartPaymentInput {
  bookingId: string;
  amount: number;
  paymentMode: "CASH" | "UPI";
  notes?: string;
}

export interface SettleAndCheckOutInput {
  bookingId: string;
  finalTotal?: number; // Manual override (discount or extra charge)
  paymentMode?: "CASH" | "UPI" | "SPLIT" | "NONE";
  cashAmount?: number;
  upiAmount?: number;
  notes?: string;
}

export interface BookingActionResult {
  success: boolean;
  message?: string;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guest?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payment?: any;
}


/**
 * Real-time phone lookup to auto-fill returning guests in check-in form.
 */
export async function lookupGuestByPhone(phone: string) {
  try {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 5) return null;

    const guest = await prisma.guest.findUnique({
      where: { phone: cleanPhone },
      include: {
        bookings: {
          select: {
            id: true,
            createdAt: true,
            room: { select: { roomNumber: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });

    return guest;
  } catch (error) {
    console.error("Error looking up guest by phone:", error);
    return null;
  }
}

/**
 * 1. createAndCheckInBooking
 * Atomic transaction validating room availability, mode restrictions,
 * status guard, date overlaps (including open-ended blocks), and token advance payment.
 */
export async function createAndCheckInBooking(
  data: CreateBookingInput
): Promise<BookingActionResult> {
  try {
    const role = (await getCurrentRole()) || "ADMIN";

    // --- Input Validation ---
    if (!data.fullName || !data.fullName.trim()) {
      throw new Error("Guest full name is required.");
    }

    const cleanPhone = normalizePhone(data.phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error("Valid 10-digit mobile number is required.");
    }

    if (!data.agreedRate || data.agreedRate <= 0) {
      throw new Error("Agreed rate must be greater than zero.");
    }

    if (data.advancePaid < 0) {
      throw new Error("Advance paid cannot be negative.");
    }

    if (data.paymentMode === "SPLIT" && data.advancePaid > 0) {
      const splitTotal = (data.cashAmount ?? 0) + (data.upiAmount ?? 0);
      if (splitTotal !== data.advancePaid) {
        throw new Error(
          `Split payment total (₹${splitTotal}) does not match advance paid (₹${data.advancePaid}).`
        );
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Validate Room & Mode (Locked Room Protection)
      const room = await tx.room.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        throw new Error("Selected room not found.");
      }

      if (
        room.mode === RoomMode.PERSONAL ||
        room.mode === "PERSONAL" ||
        room.mode === RoomMode.STORE_ROOM ||
        room.mode === "STORE_ROOM"
      ) {
        throw new Error(
          `Room ${room.roomNumber} is locked (${room.mode}) and permanently non-bookable.`
        );
      }

      // Compute 12:00 PM Check-In & Check-Out
      const checkIn = toTwelvePM(data.checkInDate);
      let expectedCheckOut: Date | null = null;

      if (data.expectedCheckOutDate && data.expectedCheckOutDate.trim()) {
        expectedCheckOut = toTwelvePM(data.expectedCheckOutDate);
        if (expectedCheckOut <= checkIn) {
          throw new Error("Expected check-out date must be after check-in date.");
        }
      }

      const now = new Date();
      const todayTwelvePM = toTwelvePM(now);
      const isCheckingInNow = checkIn.getTime() <= todayTwelvePM.getTime();

      // Dirty & Maintenance Guard
      if (isCheckingInNow) {
        if (room.status === RoomStatus.NEEDS_CLEANING || room.status === "NEEDS_CLEANING") {
          throw new Error(
            `Room ${room.roomNumber} is marked as NEEDS_CLEANING. Please mark it ready before checking in guests.`
          );
        }
        if (room.status === RoomStatus.MAINTENANCE || room.status === "MAINTENANCE") {
          throw new Error(
            `Room ${room.roomNumber} is under MAINTENANCE and cannot be booked.`
          );
        }
        if (room.status === RoomStatus.OCCUPIED || room.status === "OCCUPIED") {
          throw new Error(`Room ${room.roomNumber} is currently OCCUPIED.`);
        }
      }

      // Overlap & Open-Ended Checks
      // Rule 5: Blocking a future booking on an open-ended occupied room unless expectedCheckOut is set prior to new booking
      const openEndedActive = await tx.booking.findFirst({
        where: {
          roomId: data.roomId,
          status: "ACTIVE",
          expectedCheckOut: null,
        },
      });

      if (openEndedActive) {
        throw new Error(
          `Room ${room.roomNumber} is currently occupied with an open-ended stay. An expected check-out date must be set on the active stay before booking future dates.`
        );
      }

      // If new booking is open-ended, check if there are any upcoming reservations in the future
      if (!expectedCheckOut) {
        const upcomingReservation = await tx.booking.findFirst({
          where: {
            roomId: data.roomId,
            status: { in: ["ACTIVE", "UPCOMING"] },
            checkIn: { gt: checkIn },
          },
        });

        if (upcomingReservation) {
          throw new Error(
            `Room ${room.roomNumber} has an upcoming reservation on ${upcomingReservation.checkIn.toLocaleDateString()}. Please specify an expected check-out date prior to that reservation.`
          );
        }
      } else {
        // If new booking has fixed expectedCheckOut, check date-range collisions
        const overlapping = await tx.booking.findFirst({
          where: {
            roomId: data.roomId,
            status: { in: ["ACTIVE", "UPCOMING"] },
            OR: [
              {
                checkIn: { lt: expectedCheckOut },
                expectedCheckOut: { not: null, gt: checkIn },
              },
              {
                expectedCheckOut: null,
                checkIn: { lte: expectedCheckOut },
              },
            ],
          },
        });

        if (overlapping) {
          throw new Error(
            `Room ${room.roomNumber} already has a reservation during this period.`
          );
        }
      }

      // Upsert Guest by normalized phone number (reusing ID photos)
      const existingGuest = await tx.guest.findUnique({
        where: { phone: cleanPhone },
      });

      let guest;
      if (existingGuest) {
        guest = await tx.guest.update({
          where: { phone: cleanPhone },
          data: {
            fullName: data.fullName.trim() || existingGuest.fullName,
            idProofType: data.idProofType || existingGuest.idProofType || "AADHAAR",
            idProofNo: data.idProofNo || existingGuest.idProofNo || "ON_FILE",
            idFrontUrl: data.idFrontUrl || existingGuest.idFrontUrl,
            idBackUrl: data.idBackUrl || existingGuest.idBackUrl,
            notes: data.guestNotes !== undefined ? data.guestNotes : existingGuest.notes,
          },
        });
      } else {
        guest = await tx.guest.create({
          data: {
            fullName: data.fullName.trim(),
            phone: cleanPhone,
            idProofType: data.idProofType || "AADHAAR",
            idProofNo: data.idProofNo || "ON_FILE",
            idFrontUrl: data.idFrontUrl || null,
            idBackUrl: data.idBackUrl || null,
            notes: data.guestNotes || null,
          },
        });
      }

      const bookingStatus = isCheckingInNow ? "ACTIVE" : "UPCOMING";

      // Create Booking record
      const booking = await tx.booking.create({
        data: {
          roomId: room.id,
          guestId: guest.id,
          source: data.source,
          stayType: data.stayType || "DAILY",
          checkIn,
          expectedCheckOut,
          guestsCount: data.guestsCount || 1,
          agreedRate: Math.round(Number(data.agreedRate)),
          totalPaid: Math.round(Number(data.advancePaid)),
          status: bookingStatus,
          createdBy: role,
          notes: data.bookingNotes || null,
        },
      });

      // Record Advance Payment(s)
      if (data.advancePaid > 0) {
        if (data.paymentMode === "CASH") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: Math.round(data.advancePaid),
              paymentMode: "CASH",
              paymentType: "ADVANCE",
              notes: "Advance payment (Cash)",
            },
          });
        } else if (data.paymentMode === "UPI") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: Math.round(data.advancePaid),
              paymentMode: "UPI",
              paymentType: "ADVANCE",
              notes: "Advance payment (UPI)",
            },
          });
        } else if (data.paymentMode === "SPLIT") {
          if ((data.cashAmount ?? 0) > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: Math.round(data.cashAmount!),
                paymentMode: "CASH",
                paymentType: "ADVANCE",
                notes: "Advance split (Cash)",
              },
            });
          }
          if ((data.upiAmount ?? 0) > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: Math.round(data.upiAmount!),
                paymentMode: "UPI",
                paymentType: "ADVANCE",
                notes: "Advance split (UPI)",
              },
            });
          }
        }
      }

      // Update room status to OCCUPIED if active check-in today
      if (bookingStatus === "ACTIVE") {
        await tx.room.update({
          where: { id: room.id },
          data: { status: RoomStatus.OCCUPIED },
        });
      }

      safeRevalidatePath("/");
      safeRevalidatePath("/bookings");
      safeRevalidatePath("/guests");
      safeRevalidatePath("/finance");

      return {
        success: true,
        booking,
        guest,
        message: `Successfully booked Room ${room.roomNumber} for ${guest.fullName}`,
      };
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create booking",
    };
  }
}

/**
 * 2. recordMidStayPayment
 * Records a partial mid-stay payment against an active booking.
 */
export async function recordMidStayPayment(
  data: RecordPartPaymentInput
): Promise<BookingActionResult> {
  try {
    if (!data.amount || data.amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: data.bookingId },
        include: { room: true },
      });

      if (!booking) {
        throw new Error("Booking not found.");
      }

      if (booking.status !== "ACTIVE") {
        throw new Error("Can only record payments for active stays.");
      }

      const payment = await tx.bookingPayment.create({
        data: {
          bookingId: booking.id,
          amount: Math.round(data.amount),
          paymentMode: data.paymentMode,
          paymentType: "MID_STAY",
          notes: data.notes || "Mid-stay part payment",
        },
      });

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          totalPaid: { increment: Math.round(data.amount) },
        },
      });

      safeRevalidatePath("/");
      safeRevalidatePath("/bookings");
      safeRevalidatePath("/finance");

      return {
        success: true,
        payment,
        booking: updated,
        message: `Recorded mid-stay payment of ₹${data.amount} via ${data.paymentMode} for Room ${booking.room.roomNumber}.`,
      };
    });
  } catch (error) {
    console.error("Error recording part payment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record payment",
    };
  }
}

/**
 * 3. settleAndCheckOutBooking
 * Real-world checkout settlement:
 * 1. Calculates elapsed days/months and default calculatedTotal.
 * 2. Allows Admin/Owner to manually adjust finalTotal (checkout discount or extra charges).
 * 3. Collects remaining balance (finalTotal - totalPaidSoFar) via CASH, UPI, or SPLIT.
 * 4. Marks booking COMPLETED, sets actualCheckOut, flips room to NEEDS_CLEANING (or MAINTENANCE).
 */
export async function settleAndCheckOutBooking(
  data: SettleAndCheckOutInput
): Promise<BookingActionResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: data.bookingId },
        include: { room: true, payments: true },
      });

      if (!booking) {
        throw new Error("Booking not found.");
      }

      if (booking.status !== "ACTIVE") {
        throw new Error("Only active bookings can be checked out.");
      }

      const calculated = calculateStayUnitsAndBill(booking, new Date());
      const finalBill =
        data.finalTotal !== undefined ? Math.round(Number(data.finalTotal)) : calculated.calculatedTotal;

      if (finalBill < 0) {
        throw new Error("Final bill amount cannot be negative.");
      }

      const currentPaid = booking.totalPaid;
      const balanceDue = Math.max(0, finalBill - currentPaid);

      // Collect settlement payment if balance is due
      if (balanceDue > 0) {
        const payMode = data.paymentMode || "CASH";

        if (payMode === "CASH") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: balanceDue,
              paymentMode: "CASH",
              paymentType: "CHECKOUT_SETTLEMENT",
              notes: data.notes || "Checkout balance settlement (Cash)",
            },
          });
        } else if (payMode === "UPI") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: balanceDue,
              paymentMode: "UPI",
              paymentType: "CHECKOUT_SETTLEMENT",
              notes: data.notes || "Checkout balance settlement (UPI)",
            },
          });
        } else if (payMode === "SPLIT") {
          const splitTotal = (data.cashAmount ?? 0) + (data.upiAmount ?? 0);
          if (splitTotal !== balanceDue) {
            throw new Error(
              `Split settlement total (₹${splitTotal}) does not match balance due (₹${balanceDue}).`
            );
          }
          if ((data.cashAmount ?? 0) > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: Math.round(data.cashAmount!),
                paymentMode: "CASH",
                paymentType: "CHECKOUT_SETTLEMENT",
                notes: data.notes || "Checkout settlement split (Cash)",
              },
            });
          }
          if ((data.upiAmount ?? 0) > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: Math.round(data.upiAmount!),
                paymentMode: "UPI",
                paymentType: "CHECKOUT_SETTLEMENT",
                notes: data.notes || "Checkout settlement split (UPI)",
              },
            });
          }
        }
      }

      const newTotalPaid = currentPaid + balanceDue;

      // Complete booking
      const completedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          finalTotal: finalBill,
          totalPaid: newTotalPaid,
          status: "COMPLETED",
          actualCheckOut: new Date(),
        },
      });

      // Check for open blocking maintenance issues
      const openBlockingIssue = await tx.hotelIssue.findFirst({
        where: {
          roomId: booking.roomId,
          status: "OPEN",
          blockRoom: true,
        },
      });

      const nextStatus = openBlockingIssue
        ? RoomStatus.MAINTENANCE
        : RoomStatus.NEEDS_CLEANING;

      await tx.room.update({
        where: { id: booking.roomId },
        data: { status: nextStatus },
      });

      safeRevalidatePath("/");
      safeRevalidatePath("/bookings");
      safeRevalidatePath("/finance");

      return {
        success: true,
        booking: completedBooking,
        message: `Settled & checked out Room ${booking.room.roomNumber}. Final Bill: ₹${finalBill}, Room Status: ${nextStatus}.`,
      };
    });
  } catch (error) {
    console.error("Error settling and checking out booking:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check out",
    };
  }
}

/**
 * Alias for simple 1-click check-out
 */
export async function checkOutBooking(bookingId: string) {
  return settleAndCheckOutBooking({ bookingId });
}

/**
 * 4. extendBookingStay
 * Extends expectedCheckOut or adds days to stay, recording optional advance payment.
 */
export async function extendBookingStay(
  data: ExtendBookingInput
): Promise<BookingActionResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: data.bookingId },
        include: { room: true },
      });

      if (!booking) {
        throw new Error("Booking not found.");
      }

      if (booking.status !== "ACTIVE") {
        throw new Error("Only active stays can be extended.");
      }

      let newCheckOut: Date;

      if (data.newExpectedCheckOutDate) {
        newCheckOut = toTwelvePM(data.newExpectedCheckOutDate);
      } else {
        const daysToAdd = Math.max(1, data.additionalDays || 1);
        const baseDate = booking.expectedCheckOut ? new Date(booking.expectedCheckOut) : new Date();
        newCheckOut = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }

      // Verify no conflict with upcoming reservations
      const conflict = await tx.booking.findFirst({
        where: {
          roomId: booking.roomId,
          id: { not: booking.id },
          status: "UPCOMING",
          checkIn: { lt: newCheckOut },
        },
      });

      if (conflict) {
        throw new Error(
          `Cannot extend stay: Room ${booking.room.roomNumber} has an upcoming reservation starting ${conflict.checkIn.toLocaleDateString()}.`
        );
      }

      // Record any payment made along with extension
      const addAmount = data.additionalAmount ?? 0;
      if (addAmount > 0) {
        if (data.paymentMode === "CASH") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: Math.round(addAmount),
              paymentMode: "CASH",
              paymentType: "MID_STAY",
              notes: "Stay extension advance (Cash)",
            },
          });
        } else if (data.paymentMode === "UPI") {
          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              amount: Math.round(addAmount),
              paymentMode: "UPI",
              paymentType: "MID_STAY",
              notes: "Stay extension advance (UPI)",
            },
          });
        } else if (data.paymentMode === "SPLIT") {
          if ((data.cashAmount ?? 0) > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: Math.round(data.cashAmount!),
                paymentMode: "CASH",
                paymentType: "MID_STAY",
                notes: "Stay extension split (Cash)",
              },
            });
          }
          if ((data.upiAmount ?? 0) > 0) {
            await tx.bookingPayment.create({
              data: {
                bookingId: booking.id,
                amount: Math.round(data.upiAmount!),
                paymentMode: "UPI",
                paymentType: "MID_STAY",
                notes: "Stay extension split (UPI)",
              },
            });
          }
        }
      }

      const updated = await tx.booking.update({
        where: { id: data.bookingId },
        data: {
          expectedCheckOut: newCheckOut,
          ...(addAmount > 0 && { totalPaid: { increment: Math.round(addAmount) } }),
        },
      });

      safeRevalidatePath("/");
      safeRevalidatePath("/bookings");
      safeRevalidatePath("/finance");

      return {
        success: true,
        booking: updated,
        message: `Stay extended until ${newCheckOut.toLocaleDateString()}.`,
      };
    });
  } catch (error) {
    console.error("Error extending stay:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to extend stay",
    };
  }
}

/**
 * 5. swapBookingRoom
 * Moves an active guest from one room to another available room atomically.
 */
export async function swapBookingRoom(
  bookingId: string,
  newRoomId: string
): Promise<BookingActionResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { room: true },
      });

      if (!booking) throw new Error("Booking not found.");
      if (booking.status !== "ACTIVE") throw new Error("Only active bookings can be swapped.");
      if (booking.roomId === newRoomId) throw new Error("Cannot swap into the same room.");

      const targetRoom = await tx.room.findUnique({
        where: { id: newRoomId },
      });

      if (!targetRoom) throw new Error("Target room does not exist.");
      if (
        targetRoom.mode === RoomMode.PERSONAL ||
        targetRoom.mode === "PERSONAL" ||
        targetRoom.mode === RoomMode.STORE_ROOM ||
        targetRoom.mode === "STORE_ROOM"
      ) {
        throw new Error(`Room ${targetRoom.roomNumber} is locked for ${targetRoom.mode} use.`);
      }
      if (targetRoom.status !== RoomStatus.AVAILABLE && targetRoom.status !== "AVAILABLE") {
        throw new Error(`Room ${targetRoom.roomNumber} is not AVAILABLE (currently ${targetRoom.status}).`);
      }

      // Check collision on target room
      if (booking.expectedCheckOut) {
        const collision = await tx.booking.findFirst({
          where: {
            roomId: newRoomId,
            status: { in: ["ACTIVE", "UPCOMING"] },
            checkIn: { lt: booking.expectedCheckOut },
          },
        });
        if (collision) {
          throw new Error(`Room ${targetRoom.roomNumber} has a conflicting upcoming booking.`);
        }
      } else {
        const collision = await tx.booking.findFirst({
          where: {
            roomId: newRoomId,
            status: { in: ["ACTIVE", "UPCOMING"] },
          },
        });
        if (collision) {
          throw new Error(`Room ${targetRoom.roomNumber} has a conflicting booking.`);
        }
      }

      // Move booking to new room
      await tx.booking.update({
        where: { id: bookingId },
        data: { roomId: newRoomId },
      });

      // Old room -> NEEDS_CLEANING
      await tx.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.NEEDS_CLEANING },
      });

      // Target room -> OCCUPIED
      await tx.room.update({
        where: { id: newRoomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      safeRevalidatePath("/");
      safeRevalidatePath("/bookings");

      return {
        success: true,
        message: `Guest successfully moved from Room ${booking.room.roomNumber} to Room ${targetRoom.roomNumber}.`,
      };
    });
  } catch (error) {
    console.error("Error swapping rooms:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to swap room",
    };
  }
}

/**
 * 6. Dashboard Data Aggregation
 * Real-world finance strictly from BookingPayment records + Pending Running Balances.
 */
export async function getDashboardData() {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { roomNumber: "asc" },
      include: {
        bookings: {
          where: { status: "ACTIVE" },
          include: { guest: true, payments: true },
          take: 1,
        },
        issues: {
          where: { status: "OPEN" },
          take: 3,
        },
      },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Today's 12:00 PM expected checkouts (only bookings with fixed expectedCheckOut falling today)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todayCheckoutsCount = await prisma.booking.count({
      where: {
        status: "ACTIVE",
        stayType: "DAILY",
        expectedCheckOut: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // Real-world Month Cash Flow strictly from BookingPayment records
    const monthPayments = await prisma.bookingPayment.findMany({
      where: {
        paidAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: { amount: true, paymentMode: true },
    });

    const grossRevenue = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const cashRevenue = monthPayments
      .filter((p) => p.paymentMode === "CASH")
      .reduce((sum, p) => sum + p.amount, 0);
    const upiRevenue = monthPayments
      .filter((p) => p.paymentMode === "UPI")
      .reduce((sum, p) => sum + p.amount, 0);

    // Month Expenses
    const monthExpenses = await prisma.expense.findMany({
      where: {
        expenseDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: { amount: true, paymentMode: true },
    });

    const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const cashExpenses = monthExpenses
      .filter((e) => e.paymentMode === "CASH")
      .reduce((sum, e) => sum + e.amount, 0);
    const upiExpenses = monthExpenses
      .filter((e) => e.paymentMode === "UPI")
      .reduce((sum, e) => sum + e.amount, 0);

    const netProfit = grossRevenue - totalExpenses;
    const cashInHand = cashRevenue - cashExpenses;

    // Calculate Pending Running Balances of all ACTIVE stays
    const activeBookings = await prisma.booking.findMany({
      where: { status: "ACTIVE" },
      select: { checkIn: true, agreedRate: true, stayType: true, totalPaid: true },
    });

    let pendingRunningBalance = 0;
    for (const b of activeBookings) {
      const { balanceDue } = calculateStayUnitsAndBill(b, now);
      pendingRunningBalance += balanceDue;
    }

    // Bookable rooms count (15 total: 14 STANDARD + 1 STANDBY; excludes 102 & 104)
    const bookableRooms = rooms.filter(
      (r) => r.roomNumber !== "102" && r.roomNumber !== "104"
    );

    const occupiedBookableCount = bookableRooms.filter(
      (r) => r.status === RoomStatus.OCCUPIED || r.status === "OCCUPIED"
    ).length;

    // Check if all 14 standard rooms are occupied (excluding 114 standby)
    const standardRooms = bookableRooms.filter((r) => r.roomNumber !== "114");
    const allStandardOccupied = standardRooms.every(
      (r) => r.status === RoomStatus.OCCUPIED || r.status === "OCCUPIED"
    );

    return {
      success: true,
      rooms,
      kpis: {
        occupiedCount: occupiedBookableCount,
        totalBookable: bookableRooms.length, // 15
        todayCheckoutsCount,
        grossRevenue,
        cashRevenue,
        upiRevenue,
        totalExpenses,
        cashExpenses,
        upiExpenses,
        netProfit,
        cashInHand,
        pendingRunningBalance,
        allStandardDailyOccupied: allStandardOccupied,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return {
      success: false,
      rooms: [],
      kpis: {
        occupiedCount: 0,
        totalBookable: 15,
        todayCheckoutsCount: 0,
        grossRevenue: 0,
        cashRevenue: 0,
        upiRevenue: 0,
        totalExpenses: 0,
        cashExpenses: 0,
        upiExpenses: 0,
        netProfit: 0,
        cashInHand: 0,
        pendingRunningBalance: 0,
        allStandardDailyOccupied: false,
      },
      error: "Failed to load dashboard data",
    };
  }
}

/**
 * Fetch bookings grouped by tabs: Active, Upcoming, Monthly, Past
 */
export async function getBookingsLog() {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        room: true,
        guest: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const activeStays = bookings.filter((b) => b.status === "ACTIVE" && b.stayType !== "MONTHLY");
    const upcomingStays = bookings.filter((b) => b.status === "UPCOMING");
    const monthlyStays = bookings.filter((b) => b.stayType === "MONTHLY");
    const pastStays = bookings.filter((b) => b.status === "COMPLETED");

    return {
      success: true,
      activeStays,
      upcomingStays,
      monthlyStays,
      pastStays,
    };
  } catch (error) {
    console.error("Error fetching bookings log:", error);
    return {
      success: false,
      activeStays: [],
      upcomingStays: [],
      monthlyStays: [],
      pastStays: [],
      error: "Failed to load bookings",
    };
  }
}

/**
 * Fetch guest directory with visit counts and history
 */
export async function getGuestsDirectory(search?: string) {
  try {
    let whereClause = {};
    if (search && search.trim()) {
      const q = search.trim();
      whereClause = {
        OR: [
          { fullName: { contains: q } },
          { phone: { contains: q } },
        ],
      };
    }

    const guests = await prisma.guest.findMany({
      where: whereClause,
      include: {
        bookings: {
          include: { room: true, payments: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, guests };
  } catch (error) {
    console.error("Error fetching guests directory:", error);
    return { success: false, guests: [], error: "Failed to load guests" };
  }
}
