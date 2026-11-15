import { NextRequest, NextResponse } from "next/server";

/**
 * Verify OpenClaw API Key.
 * Accepts the key from:
 *  1. Header: `x-openclaw-key: <key>` (recommended to avoid Bearer conflicts)
 *  2. Header: `Authorization: Bearer <key>`
 *  3. Query param: `?key=<key>`
 * 
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

  // 1. Check custom header: x-openclaw-key
  const xApiKey = req.headers.get("x-openclaw-key") || req.headers.get("X-OpenClaw-Key");

  // 2. Check standard Authorization header: Bearer <key>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  let bearerToken: string | null = null;
  if (authHeader && authHeader.trim().toLowerCase().startsWith("bearer ")) {
    bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  // 3. Check URL query param: ?key=<key> or ?apiKey=<key>
  let queryKey: string | null = null;
  try {
    const url = new URL(req.url);
    queryKey = url.searchParams.get("key") || url.searchParams.get("apiKey");
  } catch {
    // ignore URL parsing error
  }

  const token = (xApiKey?.trim()) || (bearerToken?.trim()) || (queryKey?.trim());

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Missing OpenClaw API key. Provide via 'x-openclaw-key' header, 'Authorization: Bearer <token>', or '?key=<token>' query param.",
      },
      { status: 401 }
    );
  }

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
