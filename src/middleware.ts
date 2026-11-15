import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/openclaw(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Local test mode bypass
  if (process.env.LOCAL_TEST_MODE === "true") {
    return NextResponse.next();
  }

  // Fast bypass for OpenClaw API
  if (req.nextUrl.pathname.startsWith("/api/openclaw")) {
    return NextResponse.next();
  }

  if (isPublicRoute(req)) return;
  await auth.protect();
});

export const config = {
  // Crucial: Exclude api/openclaw from the Clerk middleware matcher entirely!
  matcher: [
    "/((?!_next|api/openclaw|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/openclaw)|trpc)(.*)",
  ],
};
