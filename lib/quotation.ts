import type { QuotationItem } from "@/lib/types";

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
