# Lodge Management System — Master Architecture & Domain Rules

## 1. Tech Stack & Environment
- **Framework:** Next.js (App Router, TypeScript, Server Actions + Route Handlers)
- **Styling & UI:** Tailwind CSS, shadcn/ui, Lucide React icons (Mobile-first responsive design for phone and desktop)
- **Database & ORM:** PostgreSQL / SQLite with Prisma ORM
- **Authentication:** Clerk (Invite-only / Public Sign-Up disabled; bypassed in local test mode via `LOCAL_TEST_MODE="true"`). Two roles: `ADMIN` and `OWNER`.
- **Image Handling:** Client-side canvas/WebP compression (target < 100KB per ID photo) uploaded to local persistent storage (`/public/uploads/ids` or S3/R2 compatible endpoint).
- **External AI Integration:** REST API endpoints under `/api/openclaw/*` secured via `Authorization: Bearer <OPENCLAW_API_KEY>`.

## 2. Business & Operational Rules
1. **Single Property Only:** No multi-property switcher, no Clerk Organizations.
2. **Zero Tax / Zero GST:** The lodge is not GST-registered. Never add CGST, SGST, or tax percentage fields anywhere in billing.
3. **Flexible Billing & Rate Negotiation:**
   - Any bookable room can be booked as either `DAILY` or `MONTHLY` (`stayType: "DAILY" | "MONTHLY"`).
   - Room tariffs are negotiated per stay (`agreedRate` in ₹ INR per day or per month).
4. **Open-Ended Checkouts by Default:**
   - Guests rarely know their exact checkout date. `expectedCheckOut` is optional/nullable (`DateTime?`).
   - By default, check-ins are open-ended unless the guest specifies a departure date.
   - An active open-ended stay blocks all future bookings on that room until an `expectedCheckOut` prior to the future booking is set.
5. **Token Advance & Checkout Settlement:**
   - At check-in, guest pays a 1-day advance (or custom token amount, even ₹0 if approved), recorded as a `BookingPayment` (`paymentType: "ADVANCE"`).
   - Guests can make partial payments mid-stay (`paymentType: "MID_STAY"`).
   - At checkout, system calculates elapsed days (minimum 1 day, rolling over at 12:00 PM daily) or months: `calculatedTotal = elapsedUnits * agreedRate`.
   - Admin/Owner can manually adjust `finalTotal` (e.g. checkout discount or extra charge).
   - Remaining balance (`finalTotal - totalPaidSoFar`) is collected via `CASH`, `UPI`, or `SPLIT` (`paymentType: "CHECKOUT_SETTLEMENT"`).
6. **Room Inventory Modes:**
   - Rooms only have `RoomMode`: `STANDARD` (14 bookable rooms), `STANDBY` (Room 114), `PERSONAL` (Room 102), or `STORE_ROOM` (Room 104).
   - Room 103 is a `STANDARD` room with `hasKitchen: true` and `notes: "Preferred Monthly Room with Kitchen"`.
   - Room 114 is reserved for family use / emergency overflow. Shows a warning badge and prompt.
   - Room 102 (`PERSONAL`) and Room 104 (`STORE_ROOM`) are permanently locked and non-bookable.
7. **No Cancellations Module:** Bookings are `UPCOMING`, `ACTIVE`, or `COMPLETED`.
8. **Booking Sources:** `WALK_IN` and `PHONE_CALL`.
9. **Standard 12:00 PM Cycle:** Standard daily check-in / check-out cutoff is 12:00 PM.

## 3. Exact 17-Room Inventory Specification

### Ground Floor (`wing: "GROUND_FLOOR"`)
- **101:** `mode: STANDARD`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN_COOLER`, `hasTv: true`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 600`
- **102:** `mode: PERSONAL`, `status: OCCUPIED`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `notes: "Personal use - Not for customers"`
- **103:** `mode: STANDARD`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN_COOLER`, `hasTv: false`, `hasKitchen: true`, `hasBalcony: false`, `defaultHintPrice: 5000`, `notes: "Preferred Monthly Room with Kitchen"`
- **104:** `mode: STORE_ROOM`, `status: MAINTENANCE`, `isAttached: false`, `bedType: NORMAL`, `cooling: FAN_ONLY`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `notes: "Store room - Not for customers"`
- **113:** `mode: STANDARD`, `isAttached: true`, `bedType: BETTER_BED`, `cooling: FAN_COOLER`, `hasTv: true`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 800`
- **114:** `mode: STANDBY`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 600`, `notes: "Family use / Last resort when all rooms full"`

### 1st Floor (`wing: "FIRST_FLOOR"`)
- **105:** `mode: STANDARD`, `isAttached: true`, `bedType: BETTER_BED`, `cooling: AC`, `hasTv: true`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 1200`
- **106:** `mode: STANDARD`, `isAttached: true`, `bedType: BETTER_BED`, `cooling: AC`, `hasTv: true`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 1200`
- **107:** `mode: STANDARD`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 600`
- **108:** `mode: STANDARD`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 600`
- **109:** `mode: STANDARD`, `isAttached: false`, `bedType: SINGLE_BED`, `cooling: FAN_ONLY`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 400`
- **110:** `mode: STANDARD`, `isAttached: false`, `bedType: DOUBLE_BED`, `cooling: FAN_ONLY`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 500`
- **111:** `mode: STANDARD`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 600`
- **112:** `mode: STANDARD`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 600`

### New Side 1st Floor (`wing: "NEW_SIDE_1F"`)
- **201:** `mode: STANDARD`, `isAttached: true`, `bedType: BETTER_BED`, `cooling: FAN_COOLER`, `hasTv: true`, `hasKitchen: true`, `hasBalcony: true`, `defaultHintPrice: 1500`
- **202:** `mode: STANDARD`, `isAttached: false`, `bedType: BETTER_BED`, `cooling: FAN_COOLER`, `hasTv: true`, `hasKitchen: true`, `hasBalcony: true`, `defaultHintPrice: 1300`
- **203:** `mode: STANDARD`, `isAttached: false`, `bedType: DOUBLE_BED`, `cooling: FAN_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `defaultHintPrice: 900`
