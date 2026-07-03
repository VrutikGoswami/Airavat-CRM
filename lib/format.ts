import type { Currency, TravellerCount } from "@/lib/types";

/** Money with thousands separators. Render inside a `.tnum` element. */
export function money(amount: number, currency: Currency = "KES"): string {
  const formatted = new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `${currency} ${formatted}`;
}

export function shortMoney(amount: number, currency: Currency = "KES"): string {
  if (Math.abs(amount) >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${currency} ${Math.round(amount / 1000)}k`;
  return money(amount, currency);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDateRange(startIso: string, endIso: string): string {
  if (!startIso) return "Dates flexible";
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  if (!end) return formatDate(startIso);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${formatDateShort(startIso)} – ${formatDate(endIso)}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "2h ago", "3d ago", "just now". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const mins = Math.round(diff / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function travellersLabel(t: TravellerCount): string {
  const parts: string[] = [`${t.adults} adult${t.adults === 1 ? "" : "s"}`];
  if (t.children) parts.push(`${t.children} child${t.children === 1 ? "" : "ren"}`);
  if (t.infants) parts.push(`${t.infants} infant${t.infants === 1 ? "" : "s"}`);
  return parts.join(", ");
}

export function travellersTotal(t: TravellerCount): number {
  return t.adults + t.children + t.infants;
}

/**
 * Reference "today" for the demo. Anchoring time logic to a fixed date keeps
 * the seeded dashboard deterministic (stable "due today"/"overdue" states)
 * and avoids SSR/CSR hydration mismatches. In a live Supabase deployment,
 * swap this for `new Date().toISOString().slice(0, 10)`.
 */
export const REFERENCE_TODAY = "2026-07-04";

const TODAY_ISO = () => REFERENCE_TODAY;

/** Build an ISO date offset by `days` from the reference today. */
export function dateFromToday(days: number): string {
  const base = new Date(`${REFERENCE_TODAY}T00:00:00Z`).getTime();
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** Build an ISO datetime offset by hours/days from the reference today. */
export function dateTimeFromToday(days: number, hour = 9, minute = 0): string {
  const d = new Date(`${REFERENCE_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function isOverdue(iso: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) < TODAY_ISO();
}

export function isToday(iso: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === TODAY_ISO();
}

export function daysUntil(iso: string): number {
  if (!iso) return Infinity;
  const target = new Date(iso.slice(0, 10)).getTime();
  const today = new Date(TODAY_ISO()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
