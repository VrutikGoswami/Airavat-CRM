import { NextResponse } from "next/server";
import { AUTH_COOKIE, findUser } from "@/lib/staff";

/** Demo sign-in: stores the chosen staff id in an httpOnly cookie. */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") {
    return NextResponse.json(
      { error: "Use Supabase email authentication in production mode." },
      { status: 400 },
    );
  }
  const body = (await request.json().catch(() => null)) as { userId?: string } | null;
  const user = body?.userId ? findUser(body.userId) : undefined;
  if (!user) {
    return NextResponse.json({ error: "Unknown user" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  res.cookies.set(AUTH_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
