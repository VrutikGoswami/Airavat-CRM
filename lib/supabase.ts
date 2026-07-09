/**
 * Supabase clients (production data mode). Not used in demo mode.
 *
 * - `getBrowserSupabase()` — anon key, for client components under RLS.
 * - `getServiceSupabase()` — service-role key, SERVER ONLY (webhooks, admin).
 *
 * Both return null when env is unset so the app degrades to demo mode instead
 * of crashing. Wire real queries behind `NEXT_PUBLIC_DATA_MODE=supabase`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function configured(value: string | undefined): value is string {
  return Boolean(value && !value.startsWith("PASTE_") && !value.endsWith("_HERE"));
}

export function isSupabaseMode(): boolean {
  return process.env.NEXT_PUBLIC_DATA_MODE === "supabase";
}

export function getBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!configured(url) || !configured(key)) return null;
  if (!browserClient) browserClient = createClient(url, key);
  return browserClient;
}

/** Server-only. Never import into a client component. */
export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configured(url) || !configured(key)) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
