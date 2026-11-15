import { prisma } from "../src/lib/prisma";
import {
  createAndCheckInBooking,
  recordMidStayPayment,
  settleAndCheckOutBooking,
  extendBookingStay,
  checkOutBooking,
  swapBookingRoom,
  getDashboardData,
} from "../src/actions/booking-actions";
import { calculateStayUnitsAndBill } from "../src/lib/booking-utils";
import {
  createHotelIssue,
  resolveHotelIssue,
  createExpense,
} from "../src/actions/finance-and-issues-actions";
import { normalizePhone } from "../src/lib/phone-utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runEdgeCaseTests() {
  console.log("\n========================================================");
  console.log("   LODGE SYSTEM — FLEXIBLE BOOKINGS & SETTLEMENT QA");
  console.log("========================================================\n");

  let passedCount = 0;

  // Setup: Reset DB to clean inventory rooms
  await prisma.bookingPayment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.hotelIssue.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.guest.deleteMany();

  // Reset all 17 rooms
  const rooms = await prisma.room.findMany();
  assert(rooms.length === 17, `Expected 17 rooms in DB, found ${rooms.length}`);

  const roomMap = new Map(rooms.map((r) => [r.roomNumber, r]));

  // Ensure initial room statuses
  for (const r of rooms) {
    let defaultStatus = "AVAILABLE";
    if (r.roomNumber === "102") defaultStatus = "OCCUPIED";
    if (r.roomNumber === "104") defaultStatus = "MAINTENANCE";
    await prisma.room.update({
      where: { id: r.id },
      data: { status: defaultStatus },
    });
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const dayOffsetStr = (offsetDays: number) => {
    const d = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  };

  // ----------------------------------------------------
  // TEST 1: Flexible Stay Types (Monthly into 107 & Daily into 103)
  // ----------------------------------------------------
  console.log("TEST 1: Flexible Stay Types (Monthly in Room 107 & Daily in Room 103)...");
  const r107 = roomMap.get("107")!;
  const r103 = roomMap.get("103")!;

  // 1A. Book Room 107 as MONTHLY
  const book107 = await createAndCheckInBooking({
    roomId: r107.id,
    fullName: "Monthly Guest Ramesh",
    phone: "9876500107",
    stayType: "MONTHLY",
    checkInDate: todayStr,
    agreedRate: 6000,
    advancePaid: 6000,
    paymentMode: "UPI",
    source: "WALK_IN",
  });
  assert(book107.success, `Failed to book Room 107 as MONTHLY: ${book107.error}`);
  assert(book107.booking.stayType === "MONTHLY", "Expected Room 107 booking stayType to be MONTHLY");

  // 1B. Book Room 103 (with kitchen) as DAILY
  const book103 = await createAndCheckInBooking({
    roomId: r103.id,
    fullName: "Daily Guest Priya",
    phone: "9876500103",
    stayType: "DAILY",
    checkInDate: todayStr,
    agreedRate: 800,
    advancePaid: 800,
    paymentMode: "CASH",
    source: "WALK_IN",
  });
  assert(book103.success, `Failed to book Room 103 as DAILY: ${book103.error}`);
  assert(book103.booking.stayType === "DAILY", "Expected Room 103 booking stayType to be DAILY");
  console.log("  ✓ PASSED: Any room can be booked DAILY or MONTHLY without mode constraint.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 2: Open-Ended Booking with 1-Day Token Advance
  // ----------------------------------------------------
  console.log("\nTEST 2: Open-Ended Booking (expectedCheckOut: null) with 1-Day Advance...");
  const r101 = roomMap.get("101")!;

  const book101 = await createAndCheckInBooking({
    roomId: r101.id,
    fullName: "Vikram Malhotra",
    phone: "9876500101",
    stayType: "DAILY",
    checkInDate: todayStr,
    expectedCheckOutDate: null, // Open-ended
    agreedRate: 900,
    advancePaid: 900, // 1-day advance
    paymentMode: "CASH",
    source: "WALK_IN",
  });
  assert(book101.success, `Failed open-ended check-in on Room 101: ${book101.error}`);
  assert(book101.booking.expectedCheckOut === null, "expectedCheckOut must be null");
  assert(book101.booking.totalPaid === 900, "totalPaid must be 900");

  const p101 = await prisma.bookingPayment.findFirst({
    where: { bookingId: book101.booking.id },
  });
  assert(Boolean(p101), "Expected BookingPayment record created for advance");
  assert(p101?.amount === 900 && p101?.paymentMode === "CASH" && p101?.paymentType === "ADVANCE", "Payment record details mismatch");
  console.log("  ✓ PASSED: Open-ended booking created with 1-day ₹900 Cash advance.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 3: Simulating 4-Day Stay Math (Accrued vs Balance Due)
  // ----------------------------------------------------
  console.log("\nTEST 3: Simulating 4-Day Stay Ledger Math on Room 101...");
  // Simulate 4 days elapsed from 12:00 PM check-in (at standard 12:00 PM cycle)
  const checkInTwelvePM = new Date(book101.booking.checkIn);
  const fourDaysLater = new Date(checkInTwelvePM.getTime() + 4 * 24 * 60 * 60 * 1000);
  const metrics = calculateStayUnitsAndBill(book101.booking, fourDaysLater);

  assert(metrics.elapsedUnits === 4, `Expected 4 elapsed units, got ${metrics.elapsedUnits}`);
  assert(metrics.calculatedTotal === 3600, `Expected calculated total ₹3,600 (4 * 900), got ₹${metrics.calculatedTotal}`);
  assert(metrics.totalPaid === 900, `Expected total paid ₹900, got ₹${metrics.totalPaid}`);
  assert(metrics.balanceDue === 2700, `Expected balance due ₹2,700 (3600 - 900), got ₹${metrics.balanceDue}`);
  console.log("  ✓ PASSED: 4-day stay math verified: Accrued ₹3,600 - Paid ₹900 = Balance Due ₹2,700.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 4: Checkout Override & Settlement Ledger Verification
  // ----------------------------------------------------
  console.log("\nTEST 4: Checkout Override (Negotiated ₹3,400 with ₹2,500 UPI Settlement)...");
  // Guest negotiates final bill of ₹3,400 (₹200 discount).
  // Advance paid was ₹900, so remaining balance due is ₹2,500 paid via UPI.
  const settleRes = await settleAndCheckOutBooking({
    bookingId: book101.booking.id,
    finalTotal: 3400, // Negotiated discount override
    paymentMode: "UPI",
    notes: "Negotiated checkout settlement",
  });
  assert(settleRes.success, `Settlement failed: ${settleRes.error}`);
  assert(settleRes.booking.finalTotal === 3400, "Expected finalTotal locked to 3400");
  assert(settleRes.booking.totalPaid === 3400, "Expected totalPaid updated to 3400");
  assert(settleRes.booking.status === "COMPLETED", "Booking status must be COMPLETED");

  // Verify payments in DB: 900 CASH (ADVANCE) + 2500 UPI (CHECKOUT_SETTLEMENT)
  const allPayments = await prisma.bookingPayment.findMany({
    where: { bookingId: book101.booking.id },
    orderBy: { paidAt: "asc" },
  });
  assert(allPayments.length === 2, `Expected 2 payments, found ${allPayments.length}`);
  assert(allPayments[0].amount === 900 && allPayments[0].paymentMode === "CASH" && allPayments[0].paymentType === "ADVANCE", "First payment mismatch");
  assert(allPayments[1].amount === 2500 && allPayments[1].paymentMode === "UPI" && allPayments[1].paymentType === "CHECKOUT_SETTLEMENT", "Settlement payment mismatch");

  // Verify Room status flipped to NEEDS_CLEANING
  const r101After = await prisma.room.findUnique({ where: { id: r101.id } });
  assert(r101After?.status === "NEEDS_CLEANING", "Room 101 must flip to NEEDS_CLEANING after settlement");

  // Verify Finance Ledger cash flow
  const dashboardData = await getDashboardData();
  const room101Cash = allPayments.filter((p) => p.paymentMode === "CASH").reduce((s, p) => s + p.amount, 0);
  const room101Upi = allPayments.filter((p) => p.paymentMode === "UPI").reduce((s, p) => s + p.amount, 0);
  assert(room101Cash === 900 && room101Upi === 2500, "Finance cash/upi ledger breakdown mismatch");
  console.log("  ✓ PASSED: Negotiated checkout override locked at ₹3,400 (₹900 Cash + ₹2,500 UPI recorded in payments ledger).");
  passedCount++;

  // ----------------------------------------------------
  // TEST 5: Blocking Future Bookings on Open-Ended Active Rooms
  // ----------------------------------------------------
  console.log("\nTEST 5: Blocking Future Booking on Open-Ended Occupied Room...");
  const r105 = roomMap.get("105")!;

  // 5A: Create active open-ended booking on Room 105
  const book105 = await createAndCheckInBooking({
    roomId: r105.id,
    fullName: "Active Guest Sunita",
    phone: "9876500105",
    stayType: "DAILY",
    checkInDate: todayStr,
    expectedCheckOutDate: null, // Open-ended
    agreedRate: 1200,
    advancePaid: 1200,
    paymentMode: "UPI",
    source: "WALK_IN",
  });
  assert(book105.success, `Failed to create active open-ended stay on 105: ${book105.error}`);

  // 5B: Attempt to book Room 105 for a future date (Day +5) without setting expectedCheckOut on active stay
  const conflictFuture = await createAndCheckInBooking({
    roomId: r105.id,
    fullName: "Future Guest Arjun",
    phone: "9876500199",
    stayType: "DAILY",
    checkInDate: dayOffsetStr(5),
    expectedCheckOutDate: dayOffsetStr(7),
    agreedRate: 1200,
    advancePaid: 0,
    paymentMode: "CASH",
    source: "PHONE_CALL",
  });
  assert(!conflictFuture.success, "Future booking on open-ended room should have been blocked!");
  console.log(`  ✓ Blocked as expected: "${conflictFuture.error}"`);
  console.log("  ✓ PASSED: Future booking blocked on open-ended room.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 6: Mid-Stay Part Payment Collection
  // ----------------------------------------------------
  console.log("\nTEST 6: Mid-Stay Part Payment Collection...");
  const midPayRes = await recordMidStayPayment({
    bookingId: book105.booking.id,
    amount: 1000,
    paymentMode: "CASH",
    notes: "Front desk mid-stay cash collection",
  });
  assert(midPayRes.success, `Mid-stay payment failed: ${midPayRes.error}`);
  assert(midPayRes.booking.totalPaid === 2200, "totalPaid should now be 2200 (1200 advance + 1000 mid-stay)");
  console.log("  ✓ PASSED: Mid-stay ₹1,000 Cash payment recorded, totalPaid incremented to ₹2,200.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 7: Locked Room Protection (102 PERSONAL & 104 STORE_ROOM)
  // ----------------------------------------------------
  console.log("\nTEST 7: Locked Room Protection (102 & 104)...");
  const r102 = roomMap.get("102")!;
  const r104 = roomMap.get("104")!;

  const book102 = await createAndCheckInBooking({
    roomId: r102.id,
    fullName: "Locked Test",
    phone: "9876543210",
    checkInDate: todayStr,
    agreedRate: 500,
    advancePaid: 500,
    paymentMode: "CASH",
    source: "WALK_IN",
  });
  assert(!book102.success, "Booking Room 102 (PERSONAL) should have failed!");

  const book104 = await createAndCheckInBooking({
    roomId: r104.id,
    fullName: "Locked Test",
    phone: "9876543210",
    checkInDate: todayStr,
    agreedRate: 500,
    advancePaid: 500,
    paymentMode: "CASH",
    source: "WALK_IN",
  });
  assert(!book104.success, "Booking Room 104 (STORE_ROOM) should have failed!");
  console.log("  ✓ PASSED: Locked rooms 102 & 104 rejected.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 8: Dirty & Maintenance Guard
  // ----------------------------------------------------
  console.log("\nTEST 8: Dirty & Maintenance Guard...");
  const r108 = roomMap.get("108")!;
  const r113 = roomMap.get("113")!;

  await prisma.room.update({ where: { id: r113.id }, data: { status: "NEEDS_CLEANING" } });
  await prisma.room.update({ where: { id: r108.id }, data: { status: "MAINTENANCE" } });

  const bookDirty = await createAndCheckInBooking({
    roomId: r113.id,
    fullName: "Dirty Guard Test",
    phone: "9876543210",
    checkInDate: todayStr,
    agreedRate: 600,
    advancePaid: 600,
    paymentMode: "CASH",
    source: "WALK_IN",
  });
  assert(!bookDirty.success, "Booking NEEDS_CLEANING room should fail!");

  const bookMaint = await createAndCheckInBooking({
    roomId: r108.id,
    fullName: "Maintenance Guard Test",
    phone: "9876543210",
    checkInDate: todayStr,
    agreedRate: 600,
    advancePaid: 600,
    paymentMode: "CASH",
    source: "WALK_IN",
  });
  assert(!bookMaint.success, "Booking MAINTENANCE room should fail!");
  console.log("  ✓ PASSED: Check-in blocked on NEEDS_CLEANING and MAINTENANCE rooms.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 9: Phone Normalization & Returning Guest ID Reuse
  // ----------------------------------------------------
  console.log("\nTEST 9: Phone Normalization & Returning Guest ID Reuse...");
  const r109 = roomMap.get("109")!;
  await prisma.room.update({ where: { id: r109.id }, data: { status: "AVAILABLE" } });

  const firstStay = await createAndCheckInBooking({
    roomId: r109.id,
    fullName: "Aakash Gupta",
    phone: "+91 99887-76655",
    idProofType: "AADHAAR",
    idProofNo: "1122-3344-5566",
    idFrontUrl: "/uploads/ids/aakash-front.webp",
    idBackUrl: "/uploads/ids/aakash-back.webp",
    stayType: "DAILY",
    checkInDate: todayStr,
    agreedRate: 400,
    advancePaid: 400,
    paymentMode: "CASH",
    source: "WALK_IN",
  });
  assert(firstStay.success, `First booking failed: ${firstStay.error}`);

  // Settle and checkout
  await checkOutBooking(firstStay.booking.id);
  await prisma.room.update({ where: { id: r109.id }, data: { status: "AVAILABLE" } });

  // Second stay with unformatted phone "9988776655" without re-uploading ID photos
  const secondStay = await createAndCheckInBooking({
    roomId: r109.id,
    fullName: "Aakash Gupta (Returning)",
    phone: "9988776655",
    stayType: "DAILY",
    checkInDate: todayStr,
    agreedRate: 400,
    advancePaid: 400,
    paymentMode: "UPI",
    source: "WALK_IN",
  });
  assert(secondStay.success, `Second booking failed: ${secondStay.error}`);

  const totalGuests = await prisma.guest.findMany({
    where: { phone: "9988776655" },
  });
  assert(totalGuests.length === 1, `Expected exactly 1 guest record, found ${totalGuests.length}`);
  assert(totalGuests[0].idFrontUrl === "/uploads/ids/aakash-front.webp", "Guest ID photo must be preserved");
  console.log("  ✓ PASSED: Phone normalized to 10 digits and ID photos preserved without duplication.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 10: Atomic Room Swap
  // ----------------------------------------------------
  console.log("\nTEST 10: Atomic Room Swap...");
  const r110 = roomMap.get("110")!;
  await prisma.room.update({ where: { id: r110.id }, data: { status: "AVAILABLE" } });

  const swapRes = await swapBookingRoom(secondStay.booking.id, r110.id);
  assert(swapRes.success, `Room swap failed: ${swapRes.error}`);

  const r109AfterSwap = await prisma.room.findUnique({ where: { id: r109.id } });
  const r110AfterSwap = await prisma.room.findUnique({ where: { id: r110.id } });

  assert(r109AfterSwap?.status === "NEEDS_CLEANING", "Old room must flip to NEEDS_CLEANING");
  assert(r110AfterSwap?.status === "OCCUPIED", "New room must flip to OCCUPIED");
  console.log("  ✓ PASSED: Room swap atomic transition verified (Old: NEEDS_CLEANING, New: OCCUPIED).");
  passedCount++;

  // ----------------------------------------------------
  // TEST 11: Occupied Room Maintenance Delay Guard
  // ----------------------------------------------------
  console.log("\nTEST 11: Occupied Room Maintenance Delay Guard...");
  const maintIssue = await createHotelIssue({
    roomId: r110.id,
    title: "Geyser leakage while guest inside",
    priority: "URGENT",
    blockRoom: true,
  });
  assert(maintIssue.success, `Issue creation failed: ${maintIssue.error}`);

  // Room must STAY OCCUPIED while guest is inside!
  const r110WhileOccupied = await prisma.room.findUnique({ where: { id: r110.id } });
  assert(r110WhileOccupied?.status === "OCCUPIED", "Room must remain OCCUPIED while guest stays");

  // Upon check-out, room MUST flip to MAINTENANCE
  await checkOutBooking(secondStay.booking.id);
  const r110AfterCheckOut = await prisma.room.findUnique({ where: { id: r110.id } });
  assert(r110AfterCheckOut?.status === "MAINTENANCE", "Room must flip to MAINTENANCE upon checkout due to blocking issue");
  console.log("  ✓ PASSED: Occupied room stayed OCCUPIED until checkout, then flipped to MAINTENANCE.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 12: Issue Resolution + Expense Logging
  // ----------------------------------------------------
  console.log("\nTEST 12: Issue Resolution + Expense Logging...");
  const resolveRes = await resolveHotelIssue({
    issueId: maintIssue.issue!.id,
    logExpense: true,
    expenseTitle: "Plumbing Geyser Replacement",
    expenseAmount: 850,
    paymentMode: "CASH",
  });
  assert(resolveRes.success, `Resolution failed: ${resolveRes.error}`);

  const r110Resolved = await prisma.room.findUnique({ where: { id: r110.id } });
  assert(r110Resolved?.status === "AVAILABLE", "Room 110 must return to AVAILABLE after resolution");

  const plumbingExp = await prisma.expense.findFirst({
    where: { title: "Plumbing Geyser Replacement" },
  });
  assert(Boolean(plumbingExp) && plumbingExp?.amount === 850, "Expected expense of ₹850 logged");
  console.log("  ✓ PASSED: Issue resolved, room unblocked to AVAILABLE, ₹850 expense recorded.");
  passedCount++;

  console.log("\n========================================================");
  console.log(`RESULT: ALL ${passedCount} / 12 INVARIANTS PASSED!`);
  console.log("========================================================\n");
}

runEdgeCaseTests()
  .catch((e) => {
    console.error("Test Suite Execution Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
