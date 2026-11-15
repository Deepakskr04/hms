"use server";

import { cookies } from "next/headers";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { UserRole } from "@/lib/auth";

export async function switchLocalRole(newRole: UserRole) {
  const cookieStore = await cookies();
  cookieStore.set("test_role", newRole, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: "lax",
  });

  safeRevalidatePath("/");
  safeRevalidatePath("/bookings");
  safeRevalidatePath("/guests");
  safeRevalidatePath("/finance");
  safeRevalidatePath("/issues");

  return { success: true, role: newRole };
}
