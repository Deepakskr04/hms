import { prisma } from "../src/lib/prisma";

async function verify() {
  const rooms = await prisma.room.findMany({
    orderBy: { roomNumber: "asc" },
  });

  console.log(`\n=== VERIFYING ROOM INVENTORY (${rooms.length} ROOMS) ===\n`);

  console.table(
    rooms.map((r) => ({
      Room: r.roomNumber,
      Wing: r.wing,
      Mode: r.mode,
      Status: r.status,
      Cooling: r.cooling,
      Bed: r.bedType,
      Attached: r.isAttached,
      TV: r.hasTv,
      Kitchen: r.hasKitchen,
      Balcony: r.hasBalcony,
      PriceHint: r.defaultHintPrice ?? "N/A",
      Notes: r.notes ?? "",
    }))
  );

  if (rooms.length === 17) {
    console.log("SUCCESS: All 17 rooms are accurately provisioned.");
  } else {
    console.error(`ERROR: Expected 17 rooms, but found ${rooms.length}`);
    process.exit(1);
  }
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
