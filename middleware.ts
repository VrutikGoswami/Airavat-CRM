import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth is disabled for local testing. Keep only the root redirect so the bare
 * CRM URL opens the workspace directly.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
