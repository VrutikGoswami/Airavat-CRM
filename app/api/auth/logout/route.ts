import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/staff";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
