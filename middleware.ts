import { NextResponse, type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase-middleware";

/**
 * Refreshes Supabase cookie sessions in production and protects every CRM page.
 * API routes keep their own role or shared-secret checks. Demo mode uses the
 * local profile cookie so the sample workspace remains usable without Supabase.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Send the bare root to a useful landing page.
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const publicPage = pathname === "/login" || pathname.startsWith("/share/");
  const apiRoute = pathname.startsWith("/api/");

  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") {
    const { response, user } = await refreshSupabaseSession(request);
    if (!apiRoute && !publicPage && !user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    if (pathname === "/login" && user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  if (!apiRoute && !publicPage && !request.cookies.get("crm_demo_user")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
