import { createSeedData } from "@/lib/seed";
import type { User } from "@/lib/types";

/**
 * Pure staff helpers — safe to import from client or server (no next/headers).
 * The cookie-reading `getCurrentUser` lives in `lib/auth.ts` (server only).
 */
export const AUTH_COOKIE = "crm_demo_user";

const seedUsers = createSeedData().users;

export function demoUsers(): User[] {
  return seedUsers;
}

export function findUser(id: string): User | undefined {
  return seedUsers.find((u) => u.id === id);
}
