import { NextResponse, type NextRequest } from "next/server";

/**
 * ⚠️ TEMPORARY: authentication is DISABLED so the entire CRM is browsable
 * without signing in (for review/demo access). The whole app defaults to the
 * admin demo profile — see app/(app)/layout.tsx.
 *
 * TO RESTORE AUTH: revert this file and app/(app)/layout.tsx to the previous
 * commit. The original guard sent unauthenticated users to /login and paired
 * with Supabase Auth in production (see README).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Send the bare root to a useful landing page; allow everything else through.
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on pages only — skip static assets and all API routes (which handle
  // their own auth: the auth endpoints must be reachable while signed out, and
  // the WhatsApp webhook is called by Meta, not a browser).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
