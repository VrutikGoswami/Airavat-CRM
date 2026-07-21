import { optionTotals, depositAmount, optionBadges, OPTION_BADGE_LABELS } from "@/lib/quotation";
import { QUOTATION_ITEM_LABELS } from "@/lib/labels";
import { money, formatDate, formatDateRange, travellersLabel } from "@/lib/format";
import type { Customer, Quotation, QuotationItem, QuotationOption, User } from "@/lib/types";

/**
 * Print-ready quotation document. Rendered hidden on screen and shown only for
 * `@media print`, so "Generate PDF" (window.print) produces a clean,
 * letterhead-style quotation rather than a screenshot of the CRM. Excludes all
 * internal figures (cost, margin). Flight quotations get cheapest / fastest /
 * recommended labels on each option.
 */
export function QuotationDocument({
  q,
  customer,
  consultant,
  options,
  itemsFor,
}: {
  q: Quotation;
  customer?: Customer;
  consultant?: User;
  options: QuotationOption[];
  itemsFor: (optionId: string) => QuotationItem[];
}) {
  const totalFor = (id: string) => optionTotals(itemsFor(id)).total;
  const badges = optionBadges(options, totalFor, itemsFor);

  return (
    <div className="hidden print:block print:text-black">
      {/* Letterhead */}
      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <p className="text-xl font-bold tracking-tight">Airavat Tours &amp; Travels</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-widest text-neutral-600">
            Flights · Hotels · Holidays
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-base font-bold">QUOTATION</p>
          <p className="mt-1">Ref: <span className="font-semibold">{q.ref}</span></p>
          <p>Date: {formatDate(q.createdAt)}</p>
          <p>Valid until: {formatDate(q.validUntil)}</p>
        </div>
      </div>

      {/* Parties + trip */}
      <div className="mt-5 grid grid-cols-2 gap-6 text-xs">
        <div>
          <p className="font-bold uppercase tracking-wide text-neutral-600">Prepared for</p>
          <p className="mt-1 text-sm font-semibold">{customer?.name ?? "—"}</p>
          {customer?.whatsapp ? <p>{customer.whatsapp}</p> : null}
          {customer?.email ? <p>{customer.email}</p> : null}
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-neutral-600">Trip</p>
          <p className="mt-1 text-sm font-semibold">{q.destination}</p>
          <p>{formatDateRange(q.travelStartDate, q.travelEndDate)}</p>
          <p>{travellersLabel(q.travellers)} · Prices in {q.currency}</p>
        </div>
      </div>

      {/* Options */}
      <div className="mt-6 space-y-5">
        {options.map((o) => {
          const items = itemsFor(o.id);
          const t = optionTotals(items);
          const optBadges = badges.get(o.id) ?? [];
          return (
            <section key={o.id} className="break-inside-avoid border border-neutral-300">
              <div className="flex items-center justify-between gap-3 border-b border-neutral-300 bg-neutral-100 px-3 py-2">
                <p className="text-sm font-bold">
                  Option {o.label}: {o.name}
                </p>
                <div className="flex gap-1.5">
                  {optBadges.map((b) => (
                    <span
                      key={b}
                      className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        b === "recommended"
                          ? "border-black bg-black text-white"
                          : "border-neutral-500 text-neutral-700"
                      }`}
                    >
                      {OPTION_BADGE_LABELS[b]}
                    </span>
                  ))}
                </div>
              </div>
              {o.note ? <p className="px-3 pt-2 text-[11px] text-neutral-600">{o.note}</p> : null}
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-300 text-left">
                    <th className="px-3 py-1.5 font-semibold">Service</th>
                    <th className="px-3 py-1.5 font-semibold">Details</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-b border-neutral-200 align-top">
                      <td className="px-3 py-1.5 font-medium">{QUOTATION_ITEM_LABELS[i.type]}</td>
                      <td className="px-3 py-1.5 text-neutral-700">
                        {i.supplier ? `${i.supplier} — ` : ""}
                        {i.description}
                        {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {money(i.sellingPrice * i.quantity, q.currency)}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-1.5 text-neutral-500">
                        No services listed.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot>
                  {t.tax > 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-1 text-right text-neutral-600">Tax</td>
                      <td className="px-3 py-1 text-right tabular-nums">{money(t.tax, q.currency)}</td>
                    </tr>
                  ) : null}
                  <tr className="border-t border-neutral-400">
                    <td colSpan={2} className="px-3 py-1.5 text-right font-bold">Total</td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums">{money(t.total, q.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-3 py-1 text-right text-neutral-600">
                      Deposit to confirm ({q.depositPct}%)
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      {money(depositAmount(t.total, q.depositPct), q.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>
          );
        })}
      </div>

      {/* Terms */}
      <div className="mt-6 grid grid-cols-2 gap-6 text-[11px] leading-relaxed break-inside-avoid">
        <div>
          <p className="font-bold uppercase tracking-wide text-neutral-600">Not included</p>
          <ul className="mt-1 list-disc pl-4">
            {q.exclusions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-neutral-600">Terms</p>
          <p className="mt-1 text-neutral-700">{q.terms}</p>
        </div>
      </div>

      <p className="mt-6 border-t border-neutral-300 pt-3 text-[11px] text-neutral-600">
        Your consultant: {consultant?.name}
        {consultant?.email ? ` · ${consultant.email}` : ""}. This quotation presents options and does
        not confirm supplier availability or issue tickets until booked and paid. Fares and rates are
        rechecked before payment.
      </p>
    </div>
  );
}
