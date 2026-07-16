import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/staff";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") {
    const supabase = await getServerSupabase();
    await supabase?.auth.signOut();
  }
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
