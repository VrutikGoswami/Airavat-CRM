import { cookies } from "next/headers";
import { AUTH_COOKIE, findUser } from "@/lib/staff";
import { getServerSupabase } from "@/lib/supabase-server";
import { isSupabaseMode } from "@/lib/supabase";
import type { User } from "@/lib/types";

/**
 * Server-only session helper. Demo auth stores the signed-in staff id in an
 * httpOnly cookie; swapping in Supabase Auth touches only this module and the
 * middleware. Pure helpers (user list, lookup) live in `lib/staff.ts`.
 */
export { AUTH_COOKIE, findUser, demoUsers } from "@/lib/staff";

/** The currently signed-in staff member, or null. */
export async function getCurrentUser(): Promise<User | null> {
  if (isSupabaseMode()) {
    const supabase = await getServerSupabase();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: staff } = await supabase
      .from("users")
      .select("id,name,email,role,active")
      .eq("id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (!staff) return null;

    const name = String(staff.name || staff.email || user.email || "Staff");
    return {
      id: String(staff.id),
      name,
      email: String(staff.email || user.email || ""),
      role: staff.role === "admin" ? "admin" : "consultant",
      initials: name
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      active: true,
    };
  }

  const store = await cookies();
  const id = store.get(AUTH_COOKIE)?.value;
  if (!id) return null;
  return findUser(id) ?? null;
}
