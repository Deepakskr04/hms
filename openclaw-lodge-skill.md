# OpenClaw AI Skill Specification: Lodge Management System

This skill gives OpenClaw autonomous voice, WhatsApp, and chat agents bidirectional access to manage room inventory, live check-ins, stay extensions, checkout settlements, operational expenses, and maintenance issues for our custom Lodge Management System.

---

## 1. Authentication & Base URL
- **Base URL:** `http://localhost:3000` (or `https://<YOUR_DEPLOYED_DOMAIN>`)
- **Headers Required:**
  ```http
  Authorization: Bearer <OPENCLAW_API_KEY>
  Content-Type: application/json
  ```
- **Default Local Key:** `oc_local_test_key_123`

---

## 2. API Endpoints Reference

### 1. Property Status & Live Roster
- **Method & Path:** `GET /api/openclaw/status`
- **Description:** Real-time occupancy counts, clean available rooms list with amenities, active guests roster with stay elapsed days and running balance due, today and month revenue, and open maintenance issues.
- **Natural Language Trigger Examples:**
  - *"What is our occupancy right now?"*
  - *"Which rooms are available with AC?"*
  - *"Who is currently staying in Room 101 and what is their running balance?"*
  - *"How much money did we collect today in Cash and UPI?"*
- **Response Format:**
  ```json
  {
    "success": true,
    "timestamp": "2026-11-15T01:30:00.000Z",
    "occupancy": {
      "totalRooms": 17,
      "occupiedCount": 3,
      "availableCount": 11,
      "needsCleaningCount": 1,
      "maintenanceCount": 2
    },
    "availableRooms": [
      {
        "roomNumber": "106",
        "wing": "FIRST_FLOOR",
        "mode": "STANDARD",
        "cooling": "AC",
        "bedType": "BETTER_BED",
        "isAttached": true,
        "defaultHintPrice": 1200
      }
    ],
    "activeStays": [
      {
        "bookingId": "cuid...",
        "roomNumber": "101",
        "guestName": "Rajesh Sharma",
        "phone": "9876543210",
        "stayType": "DAILY",
        "daysElapsed": 1,
        "agreedRate": 600,
        "totalPaid": 600,
        "accruedBalanceDue": 0
      }
    ],
    "financeTodayAndMonth": {
      "todayCashIn": 300,
      "todayUpiIn": 300,
      "todayTotalIn": 600,
      "monthCashIn": 1300,
      "monthUpiIn": 6700,
      "monthTotalIn": 8000,
      "monthExpenses": 1650,
      "monthNetProfit": 6350,
      "totalPendingActiveBalances": 0
    },
    "openIssues": []
  }
  ```

---

### 2. Check-In / Create Booking
- **Method & Path:** `POST /api/openclaw/bookings`
- **Description:** Checks a guest into any bookable room (`STANDARD` or `STANDBY`). Supports open-ended checkout (`expectedCheckOut: null`) or fixed dates, Daily or Monthly stays, and initial token advance via Cash, UPI, or Split. Upserts guest by 10-digit phone number.
- **Natural Language Trigger Examples:**
  - *"Check in Rahul 9876543210 to Room 106 at 1200/day with 1200 UPI advance."*
  - *"Book Room 201 for Anita 9845012345 open-ended at 1500 per day with 800 cash and 700 UPI advance."*
  - *"Check in Suresh 9123456780 into Room 103 on monthly rent of 5000 with 5000 UPI."*
- **Request Body:**
  ```json
  {
    "roomNumber": "106",
    "guestName": "Rahul Verma",
    "phone": "9876543210",
    "stayType": "DAILY",
    "expectedCheckOut": null,
    "agreedRate": 1200,
    "advancePaid": 1200,
    "paymentMode": "UPI",
    "source": "WALK_IN",
    "notes": "Voice agent check-in"
  }
  ```
- **Response Format:**
  ```json
  {
    "success": true,
    "message": "Successfully booked Room 106 for Rahul Verma via OpenClaw.",
    "booking": {
      "bookingId": "cuid...",
      "roomNumber": "106",
      "guestName": "Rahul Verma",
      "stayType": "DAILY",
      "agreedRate": 1200,
      "advancePaid": 1200
    }
  }
  ```

---

### 3. Check-Out & Final Settlement
- **Method & Path:** `POST /api/openclaw/checkout`
- **Description:** Computes accrued stay duration (rolling over at 12:00 PM daily), settles final bill with optional manual discount/override, records settlement payment, marks booking `COMPLETED`, and flips room to `NEEDS_CLEANING` (or `AVAILABLE` if `markRoomClean: true`).
- **Natural Language Trigger Examples:**
  - *"Check out Room 101 and collect the remaining balance in cash."*
  - *"Guest in 105 is checking out. Settle the bill for 2200 and collect the balance via UPI."*
  - *"Check out Room 106 and mark the room cleaned immediately."*
- **Request Body:**
  ```json
  {
    "roomNumber": "101",
    "finalAgreedTotal": 600,
    "amountCollectedNow": 0,
    "paymentMode": "CASH",
    "markRoomClean": false
  }
  ```
- **Response Format:**
  ```json
  {
    "success": true,
    "message": "Room 101 (Rajesh Sharma) settled and checked out. Room is now NEEDS_CLEANING.",
    "settlement": {
      "roomNumber": "101",
      "guestName": "Rajesh Sharma",
      "daysStayed": 1,
      "finalTotal": 600,
      "previouslyPaid": 600,
      "settlementCollected": 0,
      "totalPaid": 600,
      "roomStatus": "NEEDS_CLEANING"
    }
  }
  ```

---

### 4. Record Operational Expense
- **Method & Path:** `POST /api/openclaw/expenses`
- **Description:** Logs operational expenses (supplies, repairs, wages, utilities) deducted from lodge ledger.
- **Natural Language Trigger Examples:**
  - *"Log an expense of 450 rupees in cash for cooler motor repair."*
  - *"Record 1200 UPI paid for cleaning supplies."*
- **Request Body:**
  ```json
  {
    "title": "Cooler Motor Capacitor Repair",
    "category": "MAINTENANCE",
    "amount": 450,
    "paymentMode": "CASH",
    "notes": "Paid local electrician in cash"
  }
  ```
- **Response Format:**
  ```json
  {
    "success": true,
    "message": "Expense \"Cooler Motor Capacitor Repair\" of ₹450 (CASH) logged successfully.",
    "expense": {
      "id": "cuid...",
      "title": "Cooler Motor Capacitor Repair",
      "amount": 450,
      "paymentMode": "CASH"
    }
  }
  ```

---

### 5. Maintenance Issues (Report & Resolve)
- **Report Issue:** `POST /api/openclaw/issues`
  - *Natural Language Prompt:* *"Report an urgent water leak in Room 108 and block the room from booking."*
  - **Request Body:**
    ```json
    {
      "roomNumber": "108",
      "title": "Bathroom tap broken and leaking",
      "priority": "URGENT",
      "blockRoom": true
    }
    ```
- **Resolve Issue:** `PATCH /api/openclaw/issues`
  - *Natural Language Prompt:* *"Plumber fixed the leak in Room 108, cost was 300 in cash, unblock the room."*
  - **Request Body:**
    ```json
    {
      "roomNumber": "108",
      "repairCost": 300,
      "paymentMode": "CASH"
    }
    ```

---

## 3. Strict Operating Invariants for OpenClaw
1. **Never attempt check-in on Room 102 or 104:** Room 102 (`PERSONAL`) and Room 104 (`STORE_ROOM`) are non-bookable.
2. **Room 114 Warning:** Room 114 is a standby room. OpenClaw should prefer other standard rooms first before offering 114.
3. **No Taxes / Zero GST:** Tariffs are net negotiated INR figures without GST calculation.
4. **12:00 PM Billing Standard:** Daily stays roll over every day at 12:00 PM standard cutoff.
