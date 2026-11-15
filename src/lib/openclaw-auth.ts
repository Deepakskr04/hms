import { NextRequest, NextResponse } from "next/server";

/**
 * Verify OpenClaw Bearer API Key from request headers.
 * Returns null if authorized, or a NextResponse (401/500) if unauthorized.
 */
export function verifyOpenClawKey(req: Request | NextRequest): NextResponse | null {
  const configuredKey = process.env.OPENCLAW_API_KEY?.trim() || 
    (process.env.LOCAL_TEST_MODE === "true" ? "oc_local_test_key_123" : "");

  if (!configuredKey) {
    return NextResponse.json(
      {
        success: false,
        error: "OPENCLAW_API_KEY is not set in Vercel environment variables.",
      },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

  if (!authHeader || !authHeader.trim().toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Missing or malformed Authorization header. Expected 'Bearer <OPENCLAW_API_KEY>'.",
      },
      { status: 401 }
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (token !== configuredKey) {
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
