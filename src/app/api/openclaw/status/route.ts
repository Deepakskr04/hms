import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOpenClawKey } from "@/lib/openclaw-auth";
import { calculateStayUnitsAndBill } from "@/lib/booking-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = verifyOpenClawKey(req);
  if (authError) return authError;

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Fetch Rooms & Occupancy counts
    const rooms = await prisma.room.findMany({
      orderBy: { roomNumber: "asc" },
      include: {
        bookings: {
          where: { status: "ACTIVE" },
          include: { guest: true },
          take: 1,
        },
      },
    });

    const occupiedCount = rooms.filter((r) => r.status === "OCCUPIED").length;
    const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
    const needsCleaningCount = rooms.filter((r) => r.status === "NEEDS_CLEANING").length;
    const maintenanceCount = rooms.filter((r) => r.status === "MAINTENANCE").length;

    // 2. Available Rooms
    const availableRooms = rooms
      .filter((r) => r.status === "AVAILABLE" && r.mode !== "PERSONAL" && r.mode !== "STORE_ROOM")
      .map((r) => ({
        roomNumber: r.roomNumber,
        wing: r.wing,
        mode: r.mode,
        isAttached: r.isAttached,
        cooling: r.cooling,
        bedType: r.bedType,
        hasTv: r.hasTv,
        hasKitchen: r.hasKitchen,
        defaultHintPrice: r.defaultHintPrice,
        notes: r.notes,
      }));

    // 3. Active Stays
    const activeStays = [];
    let totalPendingActiveBalances = 0;

    for (const r of rooms) {
      if (r.status === "OCCUPIED" && r.bookings.length > 0) {
        const booking = r.bookings[0];
        const metrics = calculateStayUnitsAndBill(booking, now);
        totalPendingActiveBalances += metrics.balanceDue;

        activeStays.push({
          bookingId: booking.id,
          roomNumber: r.roomNumber,
          guestName: booking.guest.fullName,
          phone: booking.guest.phone,
          stayType: booking.stayType,
          checkIn: booking.checkIn.toISOString(),
          expectedCheckOut: booking.expectedCheckOut ? booking.expectedCheckOut.toISOString() : null,
          daysElapsed: metrics.elapsedUnits,
          agreedRate: booking.agreedRate,
          totalPaid: booking.totalPaid,
          accruedBalanceDue: metrics.balanceDue,
        });
      }
    }

    // 4. Finance Today & Month
    const todayPayments = await prisma.bookingPayment.findMany({
      where: { paidAt: { gte: startOfToday } },
      select: { amount: true, paymentMode: true },
    });

    const todayCashIn = todayPayments
      .filter((p) => p.paymentMode === "CASH")
      .reduce((s, p) => s + p.amount, 0);
    const todayUpiIn = todayPayments
      .filter((p) => p.paymentMode === "UPI")
      .reduce((s, p) => s + p.amount, 0);

    const monthPayments = await prisma.bookingPayment.findMany({
      where: { paidAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true, paymentMode: true },
    });

    const monthCashIn = monthPayments
      .filter((p) => p.paymentMode === "CASH")
      .reduce((s, p) => s + p.amount, 0);
    const monthUpiIn = monthPayments
      .filter((p) => p.paymentMode === "UPI")
      .reduce((s, p) => s + p.amount, 0);

    const monthExpensesList = await prisma.expense.findMany({
      where: { expenseDate: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true },
    });
    const monthExpenses = monthExpensesList.reduce((s, e) => s + e.amount, 0);
    const monthNetProfit = monthCashIn + monthUpiIn - monthExpenses;

    // 5. Open Hotel Issues
    const openIssues = await prisma.hotelIssue.findMany({
      where: { status: "OPEN" },
      include: {
        room: { select: { roomNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      occupancy: {
        totalRooms: rooms.length,
        occupiedCount,
        availableCount,
        needsCleaningCount,
        maintenanceCount,
      },
      availableRooms,
      activeStays,
      financeTodayAndMonth: {
        todayCashIn,
        todayUpiIn,
        todayTotalIn: todayCashIn + todayUpiIn,
        monthCashIn,
        monthUpiIn,
        monthTotalIn: monthCashIn + monthUpiIn,
        monthExpenses,
        monthNetProfit,
        totalPendingActiveBalances,
      },
      openIssues: openIssues.map((issue) => ({
        id: issue.id,
        roomNumber: issue.room?.roomNumber || null,
        title: issue.title,
        priority: issue.priority,
        blockRoom: issue.blockRoom,
        createdAt: issue.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error in GET /api/openclaw/status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch status",
      },
      { status: 500 }
    );
  }
}
