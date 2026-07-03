import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "crm_demo_user";
const PUBLIC_PATHS = ["/login", "/share"];

/**
 * Route protection. Unauthenticated users are sent to /login; signed-in users
 * hitting /login or / are sent to the dashboard. In production this pairs with
 * Supabase Auth session cookies (see README) — the guard logic is unchanged.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(AUTH_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (pathname === "/") {
    return NextResponse.redirect(new URL(signedIn ? "/dashboard" : "/login", request.url));
  }
  if (!signedIn && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (signedIn && isPublic) {
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
