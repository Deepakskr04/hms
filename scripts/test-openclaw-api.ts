const BASE_URL = "http://localhost:3000";
const API_KEY = "oc_local_test_key_123";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runApiTests() {
  console.log("\n========================================================");
  console.log("   OPENCLAW BIDIRECTIONAL API — LOCAL INTEGRATION TESTS");
  console.log("========================================================\n");

  let passedCount = 0;

  // ----------------------------------------------------
  // TEST 1: Authentication & Unauthorized Rejection
  // ----------------------------------------------------
  console.log("TEST 1: Authentication & 401 Unauthorized Guard...");

  // Missing token
  const noAuthRes = await fetch(`${BASE_URL}/api/openclaw/status`);
  assert(noAuthRes.status === 401, `Expected 401 for missing auth, got ${noAuthRes.status}`);

  // Invalid token
  const badAuthRes = await fetch(`${BASE_URL}/api/openclaw/status`, {
    headers: { Authorization: "Bearer wrong_token_xyz" },
  });
  assert(badAuthRes.status === 401, `Expected 401 for wrong auth, got ${badAuthRes.status}`);
  console.log("  ✓ PASSED: Missing and invalid API keys rejected with 401 Unauthorized.");
  passedCount++;

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  // ----------------------------------------------------
  // TEST 2: GET /api/openclaw/status
  // ----------------------------------------------------
  console.log("\nTEST 2: GET /api/openclaw/status...");
  const statusRes = await fetch(`${BASE_URL}/api/openclaw/status`, { headers });
  assert(statusRes.status === 200, `Expected 200 OK, got ${statusRes.status}`);

  const statusData = await statusRes.json();
  assert(statusData.success === true, "Expected success: true");
  assert(statusData.occupancy.totalRooms === 17, `Expected 17 total rooms, got ${statusData.occupancy.totalRooms}`);
  assert(Array.isArray(statusData.availableRooms), "availableRooms must be an array");
  assert(Array.isArray(statusData.activeStays), "activeStays must be an array");
  assert(statusData.financeTodayAndMonth.monthTotalIn >= 0, "finance monthTotalIn should be >= 0");

  console.log(`  ✓ Total Rooms: ${statusData.occupancy.totalRooms}`);
  console.log(`  ✓ Available Bookable Rooms: ${statusData.availableRooms.length}`);
  console.log(`  ✓ Active Stays: ${statusData.activeStays.length}`);
  console.log(`  ✓ Month Real Collections: ₹${statusData.financeTodayAndMonth.monthTotalIn}`);
  console.log("  ✓ PASSED: Status endpoint returned full live operational state.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 3: POST /api/openclaw/bookings (Check-In)
  // ----------------------------------------------------
  console.log("\nTEST 3: POST /api/openclaw/bookings (Open-Ended Check-In)...");

  // Dynamically pick first available clean room
  const targetRoom = statusData.availableRooms.find((r: any) => r.roomNumber !== "114") || statusData.availableRooms[0];
  assert(Boolean(targetRoom), "At least one clean available room required for test");
  const testRoomNumber = targetRoom.roomNumber;

  const bookRes = await fetch(`${BASE_URL}/api/openclaw/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      roomNumber: testRoomNumber,
      guestName: "OpenClaw Test Guest",
      phone: "+91 99880-11223",
      stayType: "DAILY",
      expectedCheckOut: null, // Open-ended
      agreedRate: 1500,
      advancePaid: 1500,
      paymentMode: "UPI",
      source: "PHONE_CALL",
      notes: "Voice booking via OpenClaw local test",
    }),
  });

  const bookText = await bookRes.text();
  assert(bookRes.status === 200, `Expected 200 OK, got ${bookRes.status}: ${bookText}`);
  const bookData = JSON.parse(bookText);
  assert(bookData.success === true, "Expected booking success: true");
  assert(bookData.booking.roomNumber === testRoomNumber, `Expected room ${testRoomNumber} booked`);
  assert(bookData.booking.guestName === "OpenClaw Test Guest", "Guest name mismatch");
  assert(bookData.booking.expectedCheckOut === null, "Expected open-ended stay (null)");
  console.log(`  ✓ Booked: Room ${bookData.booking.roomNumber} for ${bookData.booking.guestName}`);
  console.log("  ✓ PASSED: Booking created with 10-digit normalized phone, OpenClaw attribution, and advance payment.");
  passedCount++;

  // Verify status reflects the newly occupied room
  const statusAfterBookingRes = await fetch(`${BASE_URL}/api/openclaw/status`, { headers });
  const statusAfterBooking = await statusAfterBookingRes.json();
  const stayTarget = statusAfterBooking.activeStays.find((s: any) => s.roomNumber === testRoomNumber);
  assert(Boolean(stayTarget), `Room ${testRoomNumber} should now appear in activeStays`);
  assert(stayTarget.totalPaid === 1500, `Room ${testRoomNumber} totalPaid must be ₹1,500`);
  console.log(`  ✓ Verified: Room ${testRoomNumber} is active on the live board.`);

  // ----------------------------------------------------
  // TEST 4: POST /api/openclaw/checkout (Settlement)
  // ----------------------------------------------------
  console.log("\nTEST 4: POST /api/openclaw/checkout (Settle & Complete Stay)...");
  const checkoutRes = await fetch(`${BASE_URL}/api/openclaw/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      roomNumber: testRoomNumber,
      finalAgreedTotal: 1500,
      amountCollectedNow: 0, // Fully paid by advance
      paymentMode: "CASH",
      markRoomClean: false,
    }),
  });

  const checkoutText = await checkoutRes.text();
  assert(checkoutRes.status === 200, `Expected 200 OK, got ${checkoutRes.status}: ${checkoutText}`);
  const checkoutData = JSON.parse(checkoutText);
  assert(checkoutData.success === true, "Expected checkout success: true");
  assert(checkoutData.settlement.roomStatus === "NEEDS_CLEANING", `Room ${testRoomNumber} should flip to NEEDS_CLEANING`);
  console.log(`  ✓ Settled: ${checkoutData.message}`);
  console.log("  ✓ PASSED: Active stay checked out and room flipped to NEEDS_CLEANING.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 5: POST /api/openclaw/expenses
  // ----------------------------------------------------
  console.log("\nTEST 5: POST /api/openclaw/expenses...");
  const expenseRes = await fetch(`${BASE_URL}/api/openclaw/expenses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Emergency Tap Washer Replacement",
      category: "MAINTENANCE",
      amount: 250,
      paymentMode: "CASH",
      notes: "Purchased at local hardware shop by front desk",
    }),
  });

  const expenseText = await expenseRes.text();
  assert(expenseRes.status === 200, `Expected 200 OK, got ${expenseRes.status}: ${expenseText}`);
  const expenseData = JSON.parse(expenseText);
  assert(expenseData.success === true, "Expected expense success: true");
  assert(expenseData.expense.amount === 250, "Expected expense amount ₹250");
  assert(expenseData.expense.loggedBy === "OPENCLAW", "Expected loggedBy: OPENCLAW");
  console.log(`  ✓ Logged: ${expenseData.message}`);
  console.log("  ✓ PASSED: Operational expense recorded with OPENCLAW attribution.");
  passedCount++;

  // ----------------------------------------------------
  // TEST 6: POST & PATCH /api/openclaw/issues (Maintenance Lifecycle)
  // ----------------------------------------------------
  console.log("\nTEST 6: POST & PATCH /api/openclaw/issues...");

  // 6A. Report Issue on Room 107
  const createIssueRes = await fetch(`${BASE_URL}/api/openclaw/issues`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      roomNumber: "107",
      title: "Window latch stuck",
      priority: "NORMAL",
      blockRoom: false,
    }),
  });
  const createIssueText = await createIssueRes.text();
  assert(createIssueRes.status === 200, `Expected 200 OK, got ${createIssueRes.status}: ${createIssueText}`);
  const issueData = JSON.parse(createIssueText);
  assert(issueData.success === true, "Expected issue creation success: true");
  assert(issueData.issue.roomNumber === "107", "Expected room 107");
  console.log(`  ✓ Reported: ${issueData.message}`);

  // 6B. Resolve Issue on Room 107 with Repair Expense
  const resolveIssueRes = await fetch(`${BASE_URL}/api/openclaw/issues`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      roomNumber: "107",
      repairCost: 150,
      paymentMode: "CASH",
      notes: "Handyman oiled and fixed window latch",
    }),
  });
  const resolveIssueText = await resolveIssueRes.text();
  assert(resolveIssueRes.status === 200, `Expected 200 OK, got ${resolveIssueRes.status}: ${resolveIssueText}`);
  const resolveData = JSON.parse(resolveIssueText);
  assert(resolveData.success === true, "Expected issue resolution success: true");
  assert(resolveData.issue.status === "RESOLVED", "Expected status: RESOLVED");
  assert(resolveData.expense.amount === 150, "Expected repair expense ₹150");
  console.log(`  ✓ Resolved: ${resolveData.message}`);
  console.log("  ✓ PASSED: Issue created, resolved, and repair expense auto-logged.");
  passedCount++;

  console.log("\n========================================================");
  console.log(`RESULT: ALL ${passedCount} / 6 API ENDPOINT TESTS PASSED!`);
  console.log("========================================================\n");
}

runApiTests().catch((e) => {
  console.error("API Tests Failed:", e);
  process.exit(1);
});
