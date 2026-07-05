import type { Booking } from "@/lib/types";

/**
 * Booking finance helpers.
 *
 * Payment status is kept INDEPENDENT of confirmation status (Booking.status):
 * a supplier-confirmed booking can still owe a balance. Payment state is
 * derived from amounts so it stays truthful without a second stored field.
 */

export type PaymentState = {
  id: "deposit-due" | "balance-due" | "paid-in-full";
  label: string;
  tone: "warning" | "info" | "success";
};

export function paymentState(booking: Booking): PaymentState {
  const { amountPaid, totalSelling } = booking;
  if (totalSelling > 0 && amountPaid >= totalSelling) {
    return { id: "paid-in-full", label: "Paid in full", tone: "success" };
  }
  if (amountPaid > 0) {
    return { id: "balance-due", label: "Balance due", tone: "info" };
  }
  return { id: "deposit-due", label: "Deposit due", tone: "warning" };
}

/**
 * Standard balance-due lead time. Individual quotation terms can differ (some
 * say 21 days) — the structured, per-quote value arrives with the database;
 * until then bookings use this house standard.
 */
export const BALANCE_DUE_DAYS_BEFORE_TRAVEL = 30;

/** ISO date the balance falls due: travel start minus the standard lead time. */
export function balanceDueDate(
  booking: Booking,
  daysBefore = BALANCE_DUE_DAYS_BEFORE_TRAVEL,
): string | null {
  if (!booking.travelStartDate) return null;
  const start = new Date(`${booking.travelStartDate.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start - daysBefore * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Financial time basis
// ---------------------------------------------------------------------------

/**
 * All money metrics use a single, explicit basis: the BOOKED DATE
 * (Booking.createdAt) — i.e. when the sale was booked, not when travel happens
 * or payment lands. The dashboard and reports both use this so their numbers
 * reconcile; the UI labels it so the figure is unambiguous.
 */
export const FINANCIAL_BASIS_LABEL = "by booked date";

/** True if the booking was booked within [from, to] (inclusive, ISO dates). */
export function bookedInPeriod(booking: Booking, from?: string, to?: string): boolean {
  const day = booking.createdAt.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
