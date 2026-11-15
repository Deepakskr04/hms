import { prisma } from "../src/lib/prisma";
import {
  createAndCheckInBooking,
  extendBookingStay,
  checkOutBooking,
  swapBookingRoom,
  lookupGuestByPhone,
  getDashboardData,
} from "../src/actions/booking-actions";
import { markRoomCleaned } from "../src/actions/room-actions";
import {
  createHotelIssue,
  resolveHotelIssue,
  createExpense,
} from "../src/actions/finance-and-issues-actions";

async function runTests() {
  console.log("=== STARTING PHASE 2 ACTIONS TEST ===");

  // 1. Find Room 101 & Room 113
  const room101 = await prisma.room.findUnique({ where: { roomNumber: "101" } });
  const room113 = await prisma.room.findUnique({ where: { roomNumber: "113" } });
  const room105 = await prisma.room.findUnique({ where: { roomNumber: "105" } });

  if (!room101 || !room113 || !room105) {
    throw new Error("Required test rooms not found in DB");
  }

  const testPhone = "9876543210";
  const today = new Date().toISOString().split("T")[0];

  // 2. Test createAndCheckInBooking on Room 101
  console.log("\n1. Testing createAndCheckInBooking on Room 101...");
  const checkInRes = await createAndCheckInBooking({
    roomId: room101.id,
    fullName: "Ramesh Sharma",
    phone: testPhone,
    idProofType: "AADHAAR",
    idProofNo: "1234-5678-9012",
    source: "WALK_IN",
    checkInDate: today,
    daysCount: 1,
    agreedRate: 600,
    totalAmount: 600,
    advancePaid: 600,
    paymentMode: "CASH",
  });

  if (!checkInRes.success || !checkInRes.booking) {
    throw new Error(`CheckIn failed: ${checkInRes.error}`);
  }
  console.log("✓ CheckIn success! Booking ID:", checkInRes.booking.id);

  const r101AfterCheckIn = await prisma.room.findUnique({ where: { id: room101.id } });
  if (r101AfterCheckIn?.status !== "OCCUPIED") {
    throw new Error(`Expected Room 101 status OCCUPIED, got: ${r101AfterCheckIn?.status}`);
  }
  console.log("✓ Room 101 status is OCCUPIED");

  // 3. Test lookupGuestByPhone
  console.log("\n2. Testing lookupGuestByPhone...");
  const existingGuest = await lookupGuestByPhone(testPhone);
  if (!existingGuest || existingGuest.fullName !== "Ramesh Sharma") {
    throw new Error("Guest lookup failed or wrong name returned");
  }
  console.log("✓ lookupGuestByPhone returned returning guest:", existingGuest.fullName);

  // 4. Test extendBookingStay
  console.log("\n3. Testing extendBookingStay (+1 day for ₹600)...");
  const extendRes = await extendBookingStay({
    bookingId: checkInRes.booking.id,
    additionalDays: 1,
    additionalAmount: 600,
    paymentMode: "UPI",
  });
  if (!extendRes.success) throw new Error(`Extend stay failed: ${extendRes.error}`);
  console.log("✓ extendBookingStay success! TotalAmount is now:", extendRes.booking.totalAmount);

  // 5. Test swapBookingRoom from 101 to 113
  console.log("\n4. Testing swapBookingRoom (101 -> 113)...");
  const swapRes = await swapBookingRoom(checkInRes.booking.id, room113.id);
  if (!swapRes.success) throw new Error(`Room swap failed: ${swapRes.error}`);
  console.log("✓ swapBookingRoom success:", swapRes.message);

  const r101AfterSwap = await prisma.room.findUnique({ where: { id: room101.id } });
  const r113AfterSwap = await prisma.room.findUnique({ where: { id: room113.id } });
  if (r101AfterSwap?.status !== "NEEDS_CLEANING") {
    throw new Error(`Expected Room 101 NEEDS_CLEANING, got: ${r101AfterSwap?.status}`);
  }
  if (r113AfterSwap?.status !== "OCCUPIED") {
    throw new Error(`Expected Room 113 OCCUPIED, got: ${r113AfterSwap?.status}`);
  }
  console.log("✓ Room 101 flipped to NEEDS_CLEANING, Room 113 is OCCUPIED");

  // 6. Test checkOutBooking
  console.log("\n5. Testing checkOutBooking for Room 113...");
  const checkOutRes = await checkOutBooking(checkInRes.booking.id);
  if (!checkOutRes.success) throw new Error(`CheckOut failed: ${checkOutRes.error}`);
  console.log("✓ checkOutBooking success:", checkOutRes.message);

  const r113AfterCheckOut = await prisma.room.findUnique({ where: { id: room113.id } });
  if (r113AfterCheckOut?.status !== "NEEDS_CLEANING") {
    throw new Error(`Expected Room 113 NEEDS_CLEANING, got: ${r113AfterCheckOut?.status}`);
  }
  console.log("✓ Room 113 flipped to NEEDS_CLEANING");

  // 7. Test markRoomCleaned for 101 and 113
  console.log("\n6. Testing markRoomCleaned...");
  await markRoomCleaned(room101.id);
  await markRoomCleaned(room113.id);
  const r101Clean = await prisma.room.findUnique({ where: { id: room101.id } });
  const r113Clean = await prisma.room.findUnique({ where: { id: room113.id } });
  if (r101Clean?.status !== "AVAILABLE" || r113Clean?.status !== "AVAILABLE") {
    throw new Error("markRoomCleaned failed to set AVAILABLE");
  }
  console.log("✓ Both rooms restored to AVAILABLE");

  // 8. Test HotelIssue with blockRoom
  console.log("\n7. Testing createHotelIssue (blocking Room 105)...");
  const issueRes = await createHotelIssue({
    title: "AC cooling coil inspection",
    priority: "URGENT",
    blockRoom: true,
    roomId: room105.id,
  });
  if (!issueRes.success || !issueRes.issue) {
    throw new Error(`Failed to create issue: ${issueRes.error}`);
  }
  const r105Blocked = await prisma.room.findUnique({ where: { id: room105.id } });
  if (r105Blocked?.status !== "MAINTENANCE") {
    throw new Error(`Expected Room 105 MAINTENANCE, got: ${r105Blocked?.status}`);
  }
  console.log("✓ Room 105 automatically marked MAINTENANCE");

  // 9. Test resolveHotelIssue with repair expense
  console.log("\n8. Testing resolveHotelIssue with repair expense...");
  const resolveRes = await resolveHotelIssue({
    issueId: issueRes.issue.id,
    logExpense: true,
    expenseTitle: "AC Technician servicing Room 105",
    expenseAmount: 450,
    paymentMode: "CASH",
  });
  if (!resolveRes.success) throw new Error(`Resolve issue failed: ${resolveRes.error}`);

  const r105Resolved = await prisma.room.findUnique({ where: { id: room105.id } });
  if (r105Resolved?.status !== "AVAILABLE") {
    throw new Error(`Expected Room 105 restored to AVAILABLE, got: ${r105Resolved?.status}`);
  }
  console.log("✓ Room 105 restored to AVAILABLE, repair expense recorded");

  // 10. Dashboard Data
  console.log("\n9. Testing getDashboardData KPI summary...");
  const dashData = await getDashboardData();
  console.log("KPI Summary:", dashData.kpis);

  console.log("\n=== ALL PHASE 2 TESTS PASSED PERFECTLY ===");
}

runTests()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
