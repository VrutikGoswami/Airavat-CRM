"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarCheck, FileDown, Mail, Send } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { EmptyState } from "@/components/ui/misc";
import { QuotationStatusBadge } from "@/components/ui/chips";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { optionTotals, depositAmount, optionBadges, OPTION_BADGE_LABELS } from "@/lib/quotation";
import { QUOTATION_ITEM_LABELS } from "@/lib/labels";
import { money, formatDate, formatDateRange, travellersLabel } from "@/lib/format";
import { QuotationDocument } from "@/components/quotation/QuotationDocument";
import { quotationMessage } from "@/lib/quotation-message";

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ws = useWorkspace();
  const q = ws.quotation(params.id);

  if (!q) return <EmptyState title="Quotation not found" />;

  const customer = ws.customer(q.customerId);
  const consultant = ws.user(q.createdById);
  const options = ws.optionsFor(q.id);
  // Headline figures follow the recommended option (never a fixed/empty Option A).
  const primaryLabel = ws.recommendedOptionLabel(q.id) ?? options[0]?.label;
  const selected = primaryLabel;
  const existingBooking = ws.data.bookings.find((b) => b.quotationId === q.id);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${q.shareToken ?? q.id}` : "";
  const primaryOption = options.find((o) => o.label === primaryLabel) ?? options[0];
  const primaryTotals = primaryOption ? optionTotals(ws.itemsForOption(primaryOption.id)) : null;
  const primaryTotal = primaryTotals?.total ?? 0;
  const valueKes = ws.quotationValueKes(q.id);
  const badges = optionBadges(
    options,
    (id) => optionTotals(ws.itemsForOption(id)).total,
    (id) => ws.itemsForOption(id),
  );

  const convert = () => {
    const id = ws.convertToBooking(q.id);
    if (id) router.push(`/bookings/${id}`);
  };

  const deliveryMessage = quotationMessage({
    quotation: q,
    customer,
    options,
    itemsFor: (optionId) => ws.itemsForOption(optionId),
    shareUrl,
  });

  return (
    <>
    <div className="space-y-5 print:hidden">
      <Link href="/quotations" className="text-sm text-muted hover:text-terracotta">← Quotations</Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">{q.ref}</span>
              <QuotationStatusBadge status={q.status} />
            </div>
            <h1 className="mt-1 text-xl font-bold">{q.destination}</h1>
            <p className="mt-1 text-sm text-muted">
              <Link href={`/customers/${customer?.id}`} className="hover:text-terracotta">{customer?.name}</Link>
              {" · "}{formatDateRange(q.travelStartDate, q.travelEndDate)} · {travellersLabel(q.travellers)}
            </p>
            <p className="mt-1 text-xs text-muted">Valid until {formatDate(q.validUntil)} · Prepared by {consultant?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Recommended total (Option {primaryLabel})</p>
            <p className="tnum text-2xl font-bold">{money(primaryTotal, q.currency)}</p>
            {q.currency !== "KES" ? (
              <p className="tnum mt-0.5 text-xs text-muted">
                ≈ {money(valueKes, "KES")} · rate locked at 1 {q.currency} = {q.exchangeRateToKes} KES
              </p>
            ) : null}
          </div>
        </div>

        {/* Status + delivery actions */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {q.status === "draft" ? (
            <button className="btn btn-primary hover:btn-primary-hover" onClick={() => ws.updateQuotationStatus(q.id, "sent")}><Send className="size-4" /> Mark as Sent</button>
          ) : null}
          {(q.status === "sent" || q.status === "viewed") ? (
            <>
              <button className="btn btn-primary hover:btn-primary-hover" onClick={() => ws.updateQuotationStatus(q.id, "accepted")}>Mark accepted</button>
              <button className="btn btn-ghost" onClick={() => ws.updateQuotationStatus(q.id, "declined")}>Mark declined</button>
            </>
          ) : null}
          {q.status === "accepted" && !existingBooking ? (
            <button className="btn btn-primary hover:btn-primary-hover" onClick={convert}><CalendarCheck className="size-4" /> Convert to booking</button>
          ) : null}
          {existingBooking ? (
            <Link className="btn btn-ghost" href={`/bookings/${existingBooking.id}`}>View booking {existingBooking.ref}</Link>
          ) : null}
          <button className="btn btn-ghost" onClick={() => window.print()}><FileDown className="size-4" /> Generate PDF</button>
          {customer ? <WhatsAppLink phone={customer.whatsapp} message={deliveryMessage} label="Send by Whatsapp" /> : null}
          {customer?.email ? <a className="btn btn-ghost" href={`mailto:${customer.email}?subject=${encodeURIComponent(`Your quotation ${q.ref}`)}&body=${encodeURIComponent(deliveryMessage)}`}><Mail className="size-4" /> Email</a> : null}
        </div>
      </div>

      {/* Options comparison */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {options.map((o) => {
          const items = ws.itemsForOption(o.id);
          const t = optionTotals(items);
          const isSel = o.label === selected;
          return (
            <div key={o.id} className={`card p-5 ${isSel ? "ring-2 ring-terracotta" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-info">Option {o.label}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {(badges.get(o.id) ?? []).map((b) => (
                    <span key={b} className="text-xs font-semibold text-terracotta">
                      {OPTION_BADGE_LABELS[b]}
                    </span>
                  ))}
                  {!o.recommended && o.label === q.selectedOptionLabel ? (
                    <span className="text-xs font-semibold text-terracotta">Selected</span>
                  ) : null}
                </div>
              </div>
              <h3 className="mt-2 font-semibold">{o.name}</h3>
              {o.note ? <p className="mt-1 text-xs text-muted">{o.note}</p> : null}
              <ul className="mt-3 divide-y divide-line text-sm">
                {items.map((i) => {
                  const sup = ws.supplier(i.supplierId);
                  const cancellation = sup?.standardCancellation ?? i.cancellation;
                  return (
                    <li key={i.id} className="py-2">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{QUOTATION_ITEM_LABELS[i.type]}</span>
                        <span className="tnum text-muted">{money(i.sellingPrice * i.quantity, q.currency)}</span>
                      </div>
                      <p className="text-xs text-muted">{i.supplier ? `${i.supplier} — ` : ""}{i.description}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</p>
                      {cancellation ? (
                        <p className="text-[11px] text-muted">
                          Cancellation: {cancellation}
                          {sup ? <span className="text-muted/80"> · via supplier directory</span> : null}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
                {items.length === 0 ? <li className="py-2 text-muted">No services.</li> : null}
              </ul>
              <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                {t.tax > 0 ? <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd className="tnum">{money(t.tax, q.currency)}</dd></div> : null}
                <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tnum">{money(t.total, q.currency)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Deposit ({q.depositPct}%)</dt><dd className="tnum">{money(depositAmount(t.total, q.depositPct), q.currency)}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>

      {/* Internal margin — staff only; excluded from the PDF and client share link */}
      <div className="card border-l-2 border-l-terracotta p-5 print:hidden">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Internal margin</h2>
          <span className="badge badge-neutral">Staff only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-4 font-semibold">Option</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Cost</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Sell</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Margin</th>
                <th className="py-1.5 text-right font-semibold">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {options.map((o) => {
                const t = optionTotals(ws.itemsForOption(o.id));
                const pct = t.sellingExTax > 0 ? Math.round((t.margin / t.sellingExTax) * 100) : 0;
                return (
                  <tr key={o.id} className={o.label === primaryLabel ? "font-semibold" : ""}>
                    <td className="py-2 pr-4">
                      Option {o.label}
                      {o.recommended ? <span className="ml-1 text-xs font-normal text-terracotta">· recommended</span> : null}
                    </td>
                    <td className="tnum py-2 pr-4 text-right">{money(t.cost, q.currency)}</td>
                    <td className="tnum py-2 pr-4 text-right">{money(t.sellingExTax, q.currency)}</td>
                    <td className="tnum py-2 pr-4 text-right" style={{ color: "var(--color-success)" }}>{money(t.margin, q.currency)}</td>
                    <td className="tnum py-2 text-right">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Not shown on the customer PDF or share link.</p>
      </div>

      {/* Terms + exclusions */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Not included</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {q.exclusions.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Terms</h2>
          <p className="text-sm leading-relaxed text-muted">{q.terms}</p>
        </div>
      </div>
    </div>

    {/* Print-only proper quotation document (window.print / Generate PDF). */}
    <QuotationDocument
      q={q}
      customer={customer}
      consultant={consultant}
      options={options}
      itemsFor={(id) => ws.itemsForOption(id)}
    />
    </>
  );
}
