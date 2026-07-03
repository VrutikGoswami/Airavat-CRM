import { cookies } from "next/headers";
import { AUTH_COOKIE, findUser } from "@/lib/staff";
import type { User } from "@/lib/types";

/**
 * Server-only session helper. Demo auth stores the signed-in staff id in an
 * httpOnly cookie; swapping in Supabase Auth touches only this module and the
 * middleware. Pure helpers (user list, lookup) live in `lib/staff.ts`.
 */
export { AUTH_COOKIE, findUser, demoUsers } from "@/lib/staff";

/** The currently signed-in staff member, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const id = store.get(AUTH_COOKIE)?.value;
  if (!id) return null;
  return findUser(id) ?? null;
}
