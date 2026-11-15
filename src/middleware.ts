import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, NextFetchEvent } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/api/openclaw(.*)",
]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Completely bypass Clerk in local test mode: zero external network calls or redirects
  if (process.env.LOCAL_TEST_MODE === "true") {
    return NextResponse.next();
  }

  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
