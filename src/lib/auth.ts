import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export type UserRole = "ADMIN" | "OWNER";

/**
 * Helper to identify whether the logged-in user is ADMIN or OWNER.
 * When LOCAL_TEST_MODE === "true", reads from local cookie "test_role" (defaults to "ADMIN").
 * Otherwise checks Clerk session claims and publicMetadata:
 * - Reads from sessionClaims?.metadata?.role or sessionClaims?.publicMetadata?.role
 * - Reads from user.publicMetadata.role
 * - If user email matches process.env.ADMIN_EMAIL, assigns "ADMIN"
 * - Defaults to "OWNER" if authenticated
 */
export async function getCurrentRole(): Promise<UserRole | null> {
  // 1. Bypass Clerk in LOCAL_TEST_MODE
  if (process.env.LOCAL_TEST_MODE === "true") {
    try {
      const cookieStore = await cookies();
      const testRole = cookieStore.get("test_role")?.value;
      if (testRole === "OWNER") return "OWNER";
      return "ADMIN";
    } catch {
      return "ADMIN";
    }
  }

  // 2. Production Clerk Authentication
  try {
    const { sessionClaims, userId } = await auth();

    if (!userId) {
      return null;
    }

    const sessionMetadata = (sessionClaims?.metadata ?? sessionClaims?.publicMetadata) as
      | { role?: string }
      | undefined;

    let role = (sessionMetadata?.role ?? (sessionClaims as Record<string, unknown>)?.role) as
      | string
      | undefined;

    const user = await currentUser();

    if (!role && user) {
      role = user.publicMetadata?.role as string | undefined;
    }

    // Check for primary admin email override
    const primaryEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (!role && adminEmail && primaryEmail === adminEmail) {
      return "ADMIN";
    }

    if (role === "ADMIN" || role === "OWNER") {
      return role;
    }

    // Default to "OWNER" if authenticated
    return "OWNER";
  } catch (error) {
    console.error("Error retrieving current user role from Clerk:", error);
    return null;
  }
}

export async function isOwner(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "OWNER";
}

export async function isAdmin(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "ADMIN";
}

export async function requireRole(allowedRoles: UserRole[]): Promise<UserRole> {
  const role = await getCurrentRole();
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Unauthorized: Insufficient role permissions");
  }
  return role;
}
