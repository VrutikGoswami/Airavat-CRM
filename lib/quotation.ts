import type { QuotationItem, QuotationOption } from "@/lib/types";

export type OptionTotals = {
  cost: number;
  sellingExTax: number;
  tax: number;
  total: number;
  margin: number;
};

/** Totals for a single quotation option from its line items. */
export function optionTotals(items: QuotationItem[]): OptionTotals {
  let cost = 0;
  let sellingExTax = 0;
  let tax = 0;
  for (const item of items) {
    const lineSelling = item.sellingPrice * item.quantity;
    const lineCost = item.costPrice * item.quantity;
    const lineTax = (lineSelling * item.taxPct) / 100;
    cost += lineCost;
    sellingExTax += lineSelling;
    tax += lineTax;
  }
  const total = sellingExTax + tax;
  return { cost, sellingExTax, tax, total, margin: sellingExTax - cost };
}

/** Selling price implied by a cost + markup percentage. */
export function sellingFromMarkup(costPrice: number, markupPct: number): number {
  return Math.round(costPrice * (1 + markupPct / 100) * 100) / 100;
}

export function depositAmount(total: number, depositPct: number): number {
  return Math.round((total * depositPct) / 100);
}

// --- Flight option labels (cheapest / fastest / recommended) ----------------

export type OptionBadge = "recommended" | "cheapest" | "fastest";

export const OPTION_BADGE_LABELS: Record<OptionBadge, string> = {
  recommended: "Recommended",
  cheapest: "Cheapest",
  fastest: "Fastest",
};

/** Stops encoded by the flight finder in an option note, e.g. "Direct | 23kg"
 *  or "1 stops | 23kg". Returns null when the note isn't a flight note. */
function stopsFromNote(note: string | undefined): number | null {
  if (!note) return null;
  if (/direct|non-?stop/i.test(note)) return 0;
  const match = note.match(/(\d+)\s*stop/i);
  return match ? Number(match[1]) : null;
}

/**
 * Derives per-option badges for a set of options. "Cheapest" is the lowest
 * total, "fastest" the fewest stops (from the flight finder's option note),
 * and "recommended" the flagged option. Ties get no badge for that axis
 * (except recommended, which is explicit). Options with equal totals/stops as
 * the winner are not badged to avoid ambiguity.
 */
export function optionBadges(
  options: QuotationOption[],
  totalFor: (optionId: string) => number,
  itemsFor: (optionId: string) => QuotationItem[],
): Map<string, OptionBadge[]> {
  const result = new Map<string, OptionBadge[]>();
  if (options.length === 0) return result;

  const push = (id: string, badge: OptionBadge) => {
    const list = result.get(id) ?? [];
    if (!list.includes(badge)) list.push(badge);
    result.set(id, list);
  };

  // Only surface cheapest/fastest when every option is a flight option, so the
  // labels are meaningful (a hotel package shouldn't be tagged "fastest").
  const isFlightQuote = options.every((o) =>
    itemsFor(o.id).some((i) => i.type === "flight"),
  );

  for (const o of options) if (o.recommended) push(o.id, "recommended");

  if (isFlightQuote && options.length > 1) {
    const totals = options.map((o) => ({ id: o.id, total: totalFor(o.id) }));
    const minTotal = Math.min(...totals.map((t) => t.total));
    const cheapest = totals.filter((t) => t.total === minTotal);
    if (cheapest.length === 1) push(cheapest[0].id, "cheapest");

    const stops = options
      .map((o) => ({ id: o.id, stops: stopsFromNote(o.note) }))
      .filter((s): s is { id: string; stops: number } => s.stops !== null);
    if (stops.length === options.length) {
      const minStops = Math.min(...stops.map((s) => s.stops));
      const fastest = stops.filter((s) => s.stops === minStops);
      if (fastest.length === 1) push(fastest[0].id, "fastest");
    }
  }

  return result;
}
