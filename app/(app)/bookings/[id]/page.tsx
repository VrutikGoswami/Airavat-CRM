"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Banknote } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { EmptyState } from "@/components/ui/misc";
import { BookingStatusBadge } from "@/components/ui/chips";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/forms/Field";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { paymentSchema, type PaymentForm } from "@/lib/schemas";
import { BOOKING_STATUS_LABELS, PAYMENT_METHOD_LABELS, TASK_TYPE_LABELS } from "@/lib/labels";
import { paymentState, balanceDueDate } from "@/lib/booking";
import { deriveBookingTasks } from "@/lib/task-rules";
import { money, formatDate, formatDateRange, travellersLabel, relativeTime } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const ws = useWorkspace();
  const b = ws.booking(params.id);
  const [payOpen, setPayOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: "mpesa", amount: 0, reference: "" },
  });

  if (!b) return <EmptyState title="Booking not found" />;

  const customer = ws.customer(b.customerId);
  const consultant = ws.user(b.assignedConsultantId);
  const payments = ws.data.payments.filter((p) => p.bookingId === b.id);
  const outstanding = ws.outstandingFor(b);
  const profit = b.totalSelling - b.totalCost;
  const pay = paymentState(b);
  const balanceDue = balanceDueDate(b);
  const autoTasks = deriveBookingTasks(b);

  const submitPayment = handleSubmit((v) => {
    ws.recordPayment(b.id, v.amount, v.method, v.reference);
    reset({ method: "mpesa", amount: 0, reference: "" });
    setPayOpen(false);
  });

  const refRows = [
    { label: "Amadeus PNR", value: b.amadeusPnr },
    { label: "Hotel confirmation", value: b.hotelRefs },
    { label: "Transport confirmation", value: b.transportRef },
  ].filter((r) => r.value);

  return (
    <div className="space-y-5">
      <Link href="/bookings" className="text-sm text-muted hover:text-terracotta">← Bookings</Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-xs font-semibold text-muted">{b.ref}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                Confirmation <BookingStatusBadge status={b.status} />
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                Payment <Badge tone={pay.tone}>{pay.label}</Badge>
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold">{b.destination}</h1>
            <p className="mt-1 text-sm text-muted">
              <Link href={`/customers/${customer?.id}`} className="hover:text-terracotta">{customer?.name}</Link>
              {" · "}{formatDateRange(b.travelStartDate, b.travelEndDate)} · {travellersLabel(b.travellers)}
            </p>
            <p className="mt-1 text-xs text-muted">Managed by {consultant?.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {customer ? <WhatsAppLink phone={customer.whatsapp} message={`Hello ${customer.name.split(" ")[0]}, regarding booking ${b.ref} —`} /> : null}
            <button className="btn btn-primary hover:btn-primary-hover" onClick={() => setPayOpen(true)}><Banknote className="size-4" /> Record payment</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="field-label mb-0">Confirmation status</span>
          <select
            className="field max-w-[220px]"
            value={b.status}
            onChange={(e) => ws.updateBookingStatus(b.id, e.target.value as BookingStatus)}
          >
            {Object.entries(BOOKING_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="text-xs text-muted">Payment status is tracked separately, from amounts received.</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Services</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {b.servicesSummary.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>

          {refRows.length > 0 ? (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Supplier references</h2>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {refRows.map((r) => (
                  <div key={r.label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{r.label}</dt>
                    <dd className="tnum mt-0.5 text-sm">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Payments</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="tnum font-medium">{money(p.amount)}</p>
                      <p className="text-xs text-muted">{PAYMENT_METHOD_LABELS[p.method]} · {p.reference} · {relativeTime(p.receivedAt)}</p>
                    </div>
                    <span className="text-xs text-muted">{ws.user(p.recordedById)?.name.split(" ")[0]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Financials</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Total selling price</dt><dd className="tnum font-semibold">{money(b.totalSelling)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Total cost</dt><dd className="tnum">{money(b.totalCost)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Gross profit</dt><dd className="tnum font-semibold" style={{ color: "var(--color-success)" }}>{money(profit)}</dd></div>
            <div className="my-2 border-t border-line" />
            <div className="flex justify-between"><dt className="text-muted">Amount paid</dt><dd className="tnum">{money(b.amountPaid)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Outstanding balance</dt><dd className="tnum font-bold" style={outstanding > 0 ? { color: "var(--color-warning)" } : { color: "var(--color-success)" }}>{outstanding > 0 ? money(outstanding) : "Fully paid"}</dd></div>
            {outstanding > 0 && balanceDue ? (
              <div className="flex justify-between"><dt className="text-muted">Balance due by</dt><dd className="tnum">{formatDate(balanceDue)}</dd></div>
            ) : null}
          </dl>
          {b.quotationId ? <Link href={`/quotations/${b.quotationId}`} className="mt-4 inline-block text-sm font-semibold text-terracotta">View source quotation →</Link> : null}

          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Scheduled automatically</h3>
              <span className="badge badge-neutral">Activates with database</span>
            </div>
            <ul className="space-y-2">
              {autoTasks.map((t) => (
                <li key={t.key} className="text-sm">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {TASK_TYPE_LABELS[t.type]} · due {formatDate(t.dueDate)} · {t.reason}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Generated from the booking terms. Not yet saved — these become real tasks when the
              database is connected.
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record payment"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPayOpen(false)}>Cancel</button>
            <button className="btn btn-primary hover:btn-primary-hover" form="payment-form" type="submit">Record payment</button>
          </>
        }
      >
        <form id="payment-form" onSubmit={submitPayment} className="space-y-3.5">
          <p className="text-sm text-muted">Outstanding: <strong className="tnum">{money(outstanding)}</strong></p>
          <Field label="Amount (KES)" error={errors.amount?.message}>
            <input type="number" min={1} className="field" {...register("amount")} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Method" error={errors.method?.message}>
              <select className="field" {...register("method")}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Reference" error={errors.reference?.message}>
              <input className="field" placeholder="e.g. MPESA-XXXX" {...register("reference")} />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
