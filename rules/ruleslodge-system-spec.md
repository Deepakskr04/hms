\# Lodge Management System — Master Architecture \& Domain Rules



\## 1. Tech Stack \& Environment

\- \*\*Framework:\*\* Next.js (App Router, TypeScript, Server Actions + Route Handlers)

\- \*\*Styling \& UI:\*\* Tailwind CSS, shadcn/ui, Lucide React icons (Mobile-first responsive design for phone and desktop)

\- \*\*Database \& ORM:\*\* PostgreSQL with Prisma ORM

\- \*\*Authentication:\*\* Clerk (Invite-only / Public Sign-Up disabled). Two roles stored in Clerk `publicMetadata.role`: `ADMIN` and `OWNER`.

\- \*\*Image Handling:\*\* Client-side canvas/WebP compression (target < 100KB per ID photo) uploaded to local persistent storage (`/public/uploads/ids` or S3/R2 compatible endpoint).

\- \*\*External AI Integration:\*\* REST API endpoints under `/api/openclaw/\*` secured via `Authorization: Bearer <OPENCLAW\_API\_KEY>`.



\## 2. Strict Business Rules (DO NOT VIOLATE)

1\. \*\*Single Property Only:\*\* No multi-property switcher, no Clerk Organizations.

2\. \*\*Zero Tax / Zero GST:\*\* The lodge is not GST-registered. Never add CGST, SGST, or tax percentage fields anywhere in billing.

3\. \*\*Negotiable Room Tariffs:\*\* Room prices are negotiated per stay. Every booking takes a manual `agreedRate` (in ₹ INR) and `totalAmount`.

4\. \*\*Advance Payments Only:\*\* Guests pay upfront. Support `CASH`, `UPI`, or `SPLIT` (`cashAmount` + `upiAmount`).

5\. \*\*No Cancellations Module:\*\* Do not build cancellation or refund workflows. Bookings are `UPCOMING`, `ACTIVE`, or `COMPLETED`.

6\. \*\*Booking Sources:\*\* Only `WALK\_IN` and `PHONE\_CALL`. Do not include OTA platforms (MakeMyTrip, Booking.com, etc.).

7\. \*\*Standard Check-In / Check-Out Cycle:\*\* 12:00 PM to 12:00 PM for daily rooms.

8\. \*\*Room 114 Standby Rule:\*\* Room 114 is reserved for family/overflow. Display a distinct warning badge on Room 114 and only suggest it when all 13 standard daily rooms are occupied, while still allowing manual override booking.

9\. \*\*Room 102 \& 104 Locked:\*\* Room 102 (`PERSONAL`) and Room 104 (`STORE\_ROOM`) are permanently non-bookable.

10\. \*\*Room 103 Monthly Mode:\*\* Room 103 is configured as `MONTHLY` with a monthly rent cycle and kitchen access.



\## 3. Exact 17-Room Inventory Seed Specification

Seed the database with these exact 17 rooms:



\### Ground Floor (`wing: "GROUND\_FLOOR"`)

\- \*\*101:\*\* `mode: DAILY`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN\_COOLER`, `hasTv: true`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*102:\*\* `mode: PERSONAL`, `status: OCCUPIED`, `notes: "Personal use - Not for customers"`

\- \*\*103:\*\* `mode: MONTHLY`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN\_COOLER`, `hasTv: false`, `hasKitchen: true`, `hasBalcony: false`, `notes: "Monthly Room with Kitchen"`

\- \*\*104:\*\* `mode: STORE\_ROOM`, `status: MAINTENANCE`, `notes: "Store room - Not for customers"`

\- \*\*113:\*\* `mode: DAILY`, `isAttached: true`, `bedType: BETTER\_BED`, `cooling: FAN\_COOLER`, `hasTv: true`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*114:\*\* `mode: STANDBY`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN\_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`, `notes: "Family use / Last resort when all rooms full"`



\### 1st Floor (`wing: "FIRST\_FLOOR"`)

\- \*\*105:\*\* `mode: DAILY`, `isAttached: true`, `bedType: BETTER\_BED`, `cooling: AC`, `hasTv: true`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*106:\*\* `mode: DAILY`, `isAttached: true`, `bedType: BETTER\_BED`, `cooling: AC`, `hasTv: true`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*107:\*\* `mode: DAILY`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN\_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*108:\*\* `mode: DAILY`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN\_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*109:\*\* `mode: DAILY`, `isAttached: false`, `bedType: SINGLE\_BED`, `cooling: FAN\_ONLY`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*110:\*\* `mode: DAILY`, `isAttached: false`, `bedType: DOUBLE\_BED`, `cooling: FAN\_ONLY`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*111:\*\* `mode: DAILY`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN\_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`

\- \*\*112:\*\* `mode: DAILY`, `isAttached: true`, `bedType: NORMAL`, `cooling: FAN\_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`



\### New Side 1st Floor (`wing: "NEW\_SIDE\_1F"`)

\- \*\*201:\*\* `mode: DAILY`, `isAttached: true`, `bedType: BETTER\_BED`, `cooling: FAN\_COOLER`, `hasTv: true`, `hasKitchen: true`, `hasBalcony: true`

\- \*\*202:\*\* `mode: DAILY`, `isAttached: false`, `bedType: BETTER\_BED`, `cooling: FAN\_COOLER`, `hasTv: true`, `hasKitchen: true`, `hasBalcony: true`

\- \*\*203:\*\* `mode: DAILY`, `isAttached: false`, `bedType: DOUBLE\_BED`, `cooling: FAN\_COOLER`, `hasTv: false`, `hasKitchen: false`, `hasBalcony: false`

