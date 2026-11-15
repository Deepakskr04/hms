import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RoomMode = {
  STANDARD: "STANDARD",
  STANDBY: "STANDBY",
  PERSONAL: "PERSONAL",
  STORE_ROOM: "STORE_ROOM",
} as const;

const RoomStatus = {
  AVAILABLE: "AVAILABLE",
  OCCUPIED: "OCCUPIED",
  NEEDS_CLEANING: "NEEDS_CLEANING",
  MAINTENANCE: "MAINTENANCE",
} as const;

const CoolingType = {
  AC: "AC",
  FAN_COOLER: "FAN_COOLER",
  FAN_ONLY: "FAN_ONLY",
} as const;

const BedType = {
  NORMAL: "NORMAL",
  BETTER_BED: "BETTER_BED",
  SINGLE_BED: "SINGLE_BED",
  DOUBLE_BED: "DOUBLE_BED",
} as const;

interface RoomSeedData {
  roomNumber: string;
  wing: string;
  mode: string;
  status: string;
  isAttached: boolean;
  bedType: string;
  cooling: string;
  hasTv: boolean;
  hasKitchen: boolean;
  hasBalcony: boolean;
  defaultHintPrice?: number;
  notes?: string;
}

const roomsSeedData: RoomSeedData[] = [
  // --- Ground Floor (wing: "GROUND_FLOOR") ---
  {
    roomNumber: "101",
    wing: "GROUND_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_COOLER,
    hasTv: true,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 600,
  },
  {
    roomNumber: "102",
    wing: "GROUND_FLOOR",
    mode: RoomMode.PERSONAL,
    status: RoomStatus.OCCUPIED,
    isAttached: true,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_COOLER,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    notes: "Personal use - Not for customers",
  },
  {
    roomNumber: "103",
    wing: "GROUND_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_COOLER,
    hasTv: false,
    hasKitchen: true,
    hasBalcony: false,
    notes: "Preferred Monthly Room with Kitchen",
    defaultHintPrice: 5000,
  },
  {
    roomNumber: "104",
    wing: "GROUND_FLOOR",
    mode: RoomMode.STORE_ROOM,
    status: RoomStatus.MAINTENANCE,
    isAttached: false,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_ONLY,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    notes: "Store room - Not for customers",
  },
  {
    roomNumber: "113",
    wing: "GROUND_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.BETTER_BED,
    cooling: CoolingType.FAN_COOLER,
    hasTv: true,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 800,
  },
  {
    roomNumber: "114",
    wing: "GROUND_FLOOR",
    mode: RoomMode.STANDBY,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_COOLER,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    notes: "Family use / Last resort when all rooms full",
    defaultHintPrice: 600,
  },

  // --- 1st Floor (wing: "FIRST_FLOOR") ---
  {
    roomNumber: "105",
    wing: "FIRST_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.BETTER_BED,
    cooling: CoolingType.AC,
    hasTv: true,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 1200,
  },
  {
    roomNumber: "106",
    wing: "FIRST_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.BETTER_BED,
    cooling: CoolingType.AC,
    hasTv: true,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 1200,
  },
  {
    roomNumber: "107",
    wing: "FIRST_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_COOLER,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 600,
  },
  {
    roomNumber: "108",
    wing: "FIRST_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_COOLER,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 600,
  },
  {
    roomNumber: "109",
    wing: "FIRST_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: false,
    bedType: BedType.SINGLE_BED,
    cooling: CoolingType.FAN_ONLY,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 400,
  },
  {
    roomNumber: "110",
    wing: "FIRST_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: false,
    bedType: BedType.DOUBLE_BED,
    cooling: CoolingType.FAN_ONLY,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 500,
  },
  {
    roomNumber: "111",
    wing: "FIRST_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_COOLER,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 600,
  },
  {
    roomNumber: "112",
    wing: "FIRST_FLOOR",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.NORMAL,
    cooling: CoolingType.FAN_COOLER,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 600,
  },

  // --- New Side 1st Floor (wing: "NEW_SIDE_1F") ---
  {
    roomNumber: "201",
    wing: "NEW_SIDE_1F",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: true,
    bedType: BedType.BETTER_BED,
    cooling: CoolingType.FAN_COOLER,
    hasTv: true,
    hasKitchen: true,
    hasBalcony: true,
    defaultHintPrice: 1500,
  },
  {
    roomNumber: "202",
    wing: "NEW_SIDE_1F",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: false,
    bedType: BedType.BETTER_BED,
    cooling: CoolingType.FAN_COOLER,
    hasTv: true,
    hasKitchen: true,
    hasBalcony: true,
    defaultHintPrice: 1300,
  },
  {
    roomNumber: "203",
    wing: "NEW_SIDE_1F",
    mode: RoomMode.STANDARD,
    status: RoomStatus.AVAILABLE,
    isAttached: false,
    bedType: BedType.DOUBLE_BED,
    cooling: CoolingType.FAN_COOLER,
    hasTv: false,
    hasKitchen: false,
    hasBalcony: false,
    defaultHintPrice: 900,
  },
];

async function main() {
  console.log("Starting seed: upserting 17 rooms...");

  const isProduction = process.env.NODE_ENV === "production";

  for (const r of roomsSeedData) {
    const room = await prisma.room.upsert({
      where: { roomNumber: r.roomNumber },
      update: {
        wing: r.wing,
        mode: r.mode,
        // In production, keep existing room status so we don't wipe active stays or cleaning states
        ...(isProduction ? {} : { status: r.status }),
        isAttached: r.isAttached,
        bedType: r.bedType,
        cooling: r.cooling,
        hasTv: r.hasTv,
        hasKitchen: r.hasKitchen,
        hasBalcony: r.hasBalcony,
        defaultHintPrice: r.defaultHintPrice,
        notes: r.notes,
      },
      create: {
        roomNumber: r.roomNumber,
        wing: r.wing,
        mode: r.mode,
        status: r.status,
        isAttached: r.isAttached,
        bedType: r.bedType,
        cooling: r.cooling,
        hasTv: r.hasTv,
        hasKitchen: r.hasKitchen,
        hasBalcony: r.hasBalcony,
        defaultHintPrice: r.defaultHintPrice,
        notes: r.notes,
      },
    });
    console.log(`✓ Room ${room.roomNumber} (${room.wing}) - Mode: ${room.mode}, Status: ${room.status}`);
  }

  // Production guard: Only seed the 17 rooms and never insert fake test operational data in production
  if (isProduction) {
    const count = await prisma.room.count();
    console.log(`\nProduction mode: Verified all ${count} rooms in inventory. Skipping sample test bookings.`);
    return;
  }

  console.log("\nSeeding sample operational testing data...");

  // Clean existing bookings, issues, expenses
  await prisma.bookingPayment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.hotelIssue.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.guest.deleteMany();

  const now = new Date();
  const today12PM = new Date(now);
  today12PM.setHours(12, 0, 0, 0);

  const tomorrow12PM = new Date(today12PM.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow12PM = new Date(today12PM.getTime() + 48 * 60 * 60 * 1000);

  // 1. Guest 1: Rajesh Sharma in Room 101 (Open-Ended Daily Stay, 1-Day Advance of ₹600: ₹300 Cash + ₹300 UPI)
  const guest1 = await prisma.guest.create({
    data: {
      fullName: "Rajesh Sharma",
      phone: "9876543210",
      idProofType: "AADHAAR",
      idProofNo: "9876-5432-1098",
      notes: "Regular business visitor",
    },
  });

  const room101 = await prisma.room.findUnique({ where: { roomNumber: "101" } });
  if (room101) {
    const booking1 = await prisma.booking.create({
      data: {
        roomId: room101.id,
        guestId: guest1.id,
        source: "WALK_IN",
        stayType: "DAILY",
        checkIn: today12PM,
        expectedCheckOut: null, // Open-ended
        guestsCount: 1,
        agreedRate: 600,
        totalPaid: 600,
        status: "ACTIVE",
        createdBy: "ADMIN",
        notes: "Open-ended stay, paid 1-day advance",
        payments: {
          create: [
            {
              amount: 300,
              paymentMode: "CASH",
              paymentType: "ADVANCE",
              notes: "Advance split Cash",
            },
            {
              amount: 300,
              paymentMode: "UPI",
              paymentType: "ADVANCE",
              notes: "Advance split UPI",
            },
          ],
        },
      },
    });

    await prisma.room.update({
      where: { id: room101.id },
      data: { status: RoomStatus.OCCUPIED },
    });
    console.log("✓ Added active daily booking on Room 101 (Split: ₹300 Cash + ₹300 UPI)");
  }

  // 2. Guest 2: Anita Patel in Room 105 (2-day expected stay, ₹1,200/day, Advance ₹2,400: ₹1000 Cash + ₹1400 UPI)
  const guest2 = await prisma.guest.create({
    data: {
      fullName: "Anita Patel",
      phone: "9845012345",
      idProofType: "PASSPORT",
      idProofNo: "P12345678",
      notes: "Family visit",
    },
  });

  const room105 = await prisma.room.findUnique({ where: { roomNumber: "105" } });
  if (room105) {
    await prisma.booking.create({
      data: {
        roomId: room105.id,
        guestId: guest2.id,
        source: "PHONE_CALL",
        stayType: "DAILY",
        checkIn: today12PM,
        expectedCheckOut: dayAfterTomorrow12PM,
        guestsCount: 2,
        agreedRate: 1200,
        totalPaid: 2400,
        status: "ACTIVE",
        createdBy: "OWNER",
        notes: "2-day AC room advance paid",
        payments: {
          create: [
            {
              amount: 1000,
              paymentMode: "CASH",
              paymentType: "ADVANCE",
            },
            {
              amount: 1400,
              paymentMode: "UPI",
              paymentType: "ADVANCE",
            },
          ],
        },
      },
    });

    await prisma.room.update({
      where: { id: room105.id },
      data: { status: RoomStatus.OCCUPIED },
    });
    console.log("✓ Added active 2-day booking on Room 105 (Split: ₹1000 Cash + ₹1400 UPI)");
  }

  // 3. Guest 3: Suresh Kumar in Room 103 (Monthly stay with kitchen @ ₹5,000/month, Paid ₹5,000 UPI)
  const guest3 = await prisma.guest.create({
    data: {
      fullName: "Suresh Kumar",
      phone: "9123456780",
      idProofType: "DRIVING_LICENSE",
      idProofNo: "DL-1420110012345",
      notes: "Monthly tenant, kitchen access",
    },
  });

  const room103 = await prisma.room.findUnique({ where: { roomNumber: "103" } });
  if (room103) {
    const nextMonth = new Date(today12PM);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    await prisma.booking.create({
      data: {
        roomId: room103.id,
        guestId: guest3.id,
        source: "WALK_IN",
        stayType: "MONTHLY",
        checkIn: today12PM,
        expectedCheckOut: nextMonth,
        guestsCount: 1,
        agreedRate: 5000,
        totalPaid: 5000,
        status: "ACTIVE",
        createdBy: "ADMIN",
        notes: "Monthly rent paid via UPI",
        payments: {
          create: [
            {
              amount: 5000,
              paymentMode: "UPI",
              paymentType: "ADVANCE",
              notes: "1st Month Rent",
            },
          ],
        },
      },
    });

    await prisma.room.update({
      where: { id: room103.id },
      data: { status: RoomStatus.OCCUPIED },
    });
    console.log("✓ Added active monthly stay on Room 103 (₹5,000 UPI)");
  }

  // 4. Room 113 marked NEEDS_CLEANING
  const room113 = await prisma.room.findUnique({ where: { roomNumber: "113" } });
  if (room113) {
    await prisma.room.update({
      where: { id: room113.id },
      data: { status: RoomStatus.NEEDS_CLEANING },
    });
    console.log("✓ Marked Room 113 as NEEDS_CLEANING");
  }

  // 5. Sample Expenses
  await prisma.expense.create({
    data: {
      title: "Cooler Motor Capacitor Repair",
      category: "MAINTENANCE",
      amount: 450,
      paymentMode: "CASH",
      loggedBy: "ADMIN",
      notes: "Local electrician cash payment",
    },
  });

  await prisma.expense.create({
    data: {
      title: "Phenyl & Detergent Restock",
      category: "SUPPLIES",
      amount: 1200,
      paymentMode: "UPI",
      loggedBy: "ADMIN",
      notes: "Wholesale cleaning supplies",
    },
  });
  console.log("✓ Added 2 sample expenses (₹450 Cash + ₹1,200 UPI)");

  // 6. Maintenance Issue on Room 108
  const room108 = await prisma.room.findUnique({ where: { roomNumber: "108" } });
  if (room108) {
    await prisma.hotelIssue.create({
      data: {
        roomId: room108.id,
        title: "Ceiling fan speed regulator sparking",
        priority: "NORMAL",
        blockRoom: false,
        status: "OPEN",
        loggedBy: "ADMIN",
      },
    });
    console.log("✓ Added open maintenance issue on Room 108");
  }

  const count = await prisma.room.count();
  console.log(`\nSeed completed! Total rooms in database: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
