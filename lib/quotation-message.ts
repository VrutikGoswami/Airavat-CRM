import { formatDateRange, money, travellersLabel } from "@/lib/format";
import { optionTotals, depositAmount } from "@/lib/quotation";
import { QUOTATION_ITEM_LABELS } from "@/lib/labels";
import type { Customer, Quotation, QuotationItem, QuotationOption } from "@/lib/types";

export function quotationMessage({
  quotation,
  customer,
  options,
  itemsFor,
  shareUrl,
}: {
  quotation: Quotation;
  customer?: Customer;
  options: QuotationOption[];
  itemsFor: (optionId: string) => QuotationItem[];
  shareUrl?: string;
}): string {
  const lines = [
    `Hello ${customer?.name.split(" ")[0] ?? ""},`,
    "",
    `AIRAVAT TRAVEL QUOTATION - ${quotation.ref}`,
    `Destination: ${quotation.destination}`,
    `Dates: ${formatDateRange(quotation.travelStartDate, quotation.travelEndDate)}`,
    `Travellers: ${travellersLabel(quotation.travellers)}`,
    "",
  ];

  for (const option of options) {
    const items = itemsFor(option.id);
    const totals = optionTotals(items);
    lines.push(`OPTION ${option.label}: ${option.name}${option.recommended ? " (PREFERRED)" : ""}`);
    if (option.note) lines.push(option.note);
    for (const item of items) {
      lines.push(`- ${QUOTATION_ITEM_LABELS[item.type]}${item.supplier ? ` - ${item.supplier}` : ""}`);
      lines.push(`  Destination: ${quotation.destination}`);
      lines.push(`  Dates: ${formatDateRange(item.startDate || quotation.travelStartDate, item.endDate || quotation.travelEndDate)}`);
      lines.push(`  Details: ${item.description}${item.quantity > 1 ? ` x${item.quantity}` : ""}`);
      if (item.notes) lines.push(`  Notes: ${item.notes}`);
      if (item.cancellation) lines.push(`  Terms: ${item.cancellation}`);
      lines.push(`  Price: ${money(item.sellingPrice * item.quantity, quotation.currency)}`);
    }
    lines.push(`Subtotal: ${money(totals.sellingExTax, quotation.currency)}`);
    if (totals.tax > 0) lines.push(`Tax: ${money(totals.tax, quotation.currency)}`);
    lines.push(`Total: ${money(totals.total, quotation.currency)}`);
    lines.push(`Deposit (${quotation.depositPct}%): ${money(depositAmount(totals.total, quotation.depositPct), quotation.currency)}`);
    lines.push("");
  }

  lines.push("Prices and availability are reconfirmed before booking or ticketing.");
  if (shareUrl) lines.push(`View quotation: ${shareUrl}`);
  lines.push("", 'Reply with "Confirm" to receive the next steps.');
  return lines.join("\n");
}
