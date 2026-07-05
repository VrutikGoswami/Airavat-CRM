import type { Currency } from "@/lib/types";

/**
 * Demo exchange rates → KES. A quotation snapshots the rate at creation time
 * (`Quotation.exchangeRateToKes`) so its KES value (pipeline, reports) never
 * drifts when rates move. In production this comes from a rates provider at
 * save time — this table is the interim/demo source.
 */
export const DEMO_FX_TO_KES: Record<Currency, number> = {
  KES: 1,
  USD: 129,
  EUR: 141,
  GBP: 164,
};

export function rateForCurrency(currency: Currency): number {
  return DEMO_FX_TO_KES[currency] ?? 1;
}

/** Convert an amount in the quote's currency to KES using the snapshot rate. */
export function toKes(amount: number, exchangeRateToKes: number): number {
  return Math.round(amount * exchangeRateToKes);
}
