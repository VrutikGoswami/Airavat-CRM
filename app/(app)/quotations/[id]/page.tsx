"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, Copy, FileDown, Mail, Send } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { EmptyState } from "@/components/ui/misc";
import { QuotationStatusBadge } from "@/components/ui/chips";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { optionTotals, depositAmount } from "@/lib/quotation";
import { QUOTATION_ITEM_LABELS } from "@/lib/labels";
import { money, formatDate, formatDateRange, travellersLabel } from "@/lib/format";

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ws = useWorkspace();
  const q = ws.quotation(params.id);
  const [copied, setCopied] = useState(false);

  if (!q) return <EmptyState title="Quotation not found" />;

  const customer = ws.customer(q.customerId);
  const consultant = ws.user(q.createdById);
  const options = ws.optionsFor(q.id);
  const selected = q.selectedOptionLabel ?? options[0]?.label;
  const existingBooking = ws.data.bookings.find((b) => b.quotationId === q.id);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${q.shareToken ?? q.id}` : "";
  const primaryOption = options.find((o) => o.label === selected) ?? options[0];
  const primaryTotal = primaryOption ? optionTotals(ws.itemsForOption(primaryOption.id)).total : 0;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const convert = () => {
    const id = ws.convertToBooking(q.id);
    if (id) router.push(`/bookings/${id}`);
  };

  const waMessage = `Hello ${customer?.name.split(" ")[0] ?? ""}, here is your quotation ${q.ref} for ${q.destination}: ${shareUrl}`;

  return (
    <div className="space-y-5">
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
            <p className="text-xs text-muted">Primary total (Option {selected})</p>
            <p className="tnum text-2xl font-bold">{money(primaryTotal, q.currency)}</p>
          </div>
        </div>

        {/* Status + delivery actions */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {q.status === "draft" ? (
            <button className="btn btn-primary hover:btn-primary-hover" onClick={() => ws.updateQuotationStatus(q.id, "sent")}><Send className="size-4" /> Mark as sent</button>
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
          <button className="btn btn-ghost" onClick={copyLink}><Copy className="size-4" /> {copied ? "Copied!" : "Share link"}</button>
          {customer ? <WhatsAppLink phone={customer.whatsapp} message={waMessage} label="Send by WhatsApp" /> : null}
          {customer?.email ? <a className="btn btn-ghost" href={`mailto:${customer.email}?subject=${encodeURIComponent(`Your quotation ${q.ref}`)}&body=${encodeURIComponent(waMessage)}`}><Mail className="size-4" /> Email</a> : null}
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
              <div className="flex items-center justify-between">
                <span className="badge badge-info">Option {o.label}</span>
                {isSel ? <span className="text-xs font-semibold text-terracotta">Selected</span> : null}
              </div>
              <h3 className="mt-2 font-semibold">{o.name}</h3>
              {o.note ? <p className="mt-1 text-xs text-muted">{o.note}</p> : null}
              <ul className="mt-3 divide-y divide-line text-sm">
                {items.map((i) => (
                  <li key={i.id} className="py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{QUOTATION_ITEM_LABELS[i.type]}</span>
                      <span className="tnum text-muted">{money(i.sellingPrice * i.quantity, q.currency)}</span>
                    </div>
                    <p className="text-xs text-muted">{i.supplier ? `${i.supplier} — ` : ""}{i.description}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</p>
                    {i.cancellation ? <p className="text-[11px] text-muted">Cancellation: {i.cancellation}</p> : null}
                  </li>
                ))}
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
  );
}
