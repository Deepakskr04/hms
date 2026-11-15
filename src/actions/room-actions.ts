"use server";

import { prisma } from "@/lib/prisma";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { RoomStatus, RoomMode } from "@/types/enums";

export interface RoomActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Toggles room status between NEEDS_CLEANING -> AVAILABLE,
 * or flags / unflags MAINTENANCE.
 */
export async function updateRoomStatus(
  roomId: string,
  newStatus: RoomStatus
): Promise<RoomActionResult> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return { success: false, error: "Room not found" };
    }

    // Protect permanently non-bookable rooms (102 PERSONAL, 104 STORE_ROOM)
    if (room.mode === RoomMode.PERSONAL || room.mode === RoomMode.STORE_ROOM) {
      return {
        success: false,
        error: `Room ${room.roomNumber} is locked for ${room.mode} use and cannot be changed manually`,
      };
    }

    await prisma.room.update({
      where: { id: roomId },
      data: { status: newStatus },
    });

    safeRevalidatePath("/");
    safeRevalidatePath("/bookings");
    return {
      success: true,
      message: `Room ${room.roomNumber} updated to ${newStatus}`,
    };
  } catch (error) {
    console.error("Error updating room status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update room",
    };
  }
}

/**
 * Convenience action: Mark cleaned room as ready & available
 */
export async function markRoomCleaned(roomId: string): Promise<RoomActionResult> {
  return updateRoomStatus(roomId, RoomStatus.AVAILABLE);
}

/**
 * Convenience action: Toggle maintenance status
 */
export async function toggleRoomMaintenance(
  roomId: string,
  enableMaintenance: boolean
): Promise<RoomActionResult> {
  return updateRoomStatus(
    roomId,
    enableMaintenance ? RoomStatus.MAINTENANCE : RoomStatus.AVAILABLE
  );
}
