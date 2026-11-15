import { NextRequest, NextResponse } from "next/server";

/**
 * Verify OpenClaw Bearer API Key from request headers.
 * Returns null if authorized, or a 401 NextResponse if unauthorized.
 */
export function verifyOpenClawKey(req: Request | NextRequest): NextResponse | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const expectedKey = process.env.OPENCLAW_API_KEY || "oc_local_test_key_123";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Missing or malformed Authorization header. Expected 'Bearer <OPENCLAW_API_KEY>'.",
      },
      { status: 401 }
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (token !== expectedKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Invalid OpenClaw API key.",
      },
      { status: 401 }
    );
  }

  return null;
}
