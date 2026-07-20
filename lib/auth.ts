import { cookies } from "next/headers";
import { AUTH_COOKIE, demoUsers, findUser } from "@/lib/staff";
import type { User } from "@/lib/types";

/**
 * Server-only current-user helper.
 *
 * Auth is intentionally disabled for local CRM testing. The app still needs a
 * staff-shaped user for ownership labels, audit fields, and admin-only UI, so
 * we resolve the optional demo profile cookie and otherwise use the first demo
 * admin profile.
 */
export { AUTH_COOKIE, findUser, demoUsers } from "@/lib/staff";

/** The currently signed-in staff member, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const id = store.get(AUTH_COOKIE)?.value;
  return (id ? findUser(id) : undefined) ?? demoUsers()[0] ?? null;
}
