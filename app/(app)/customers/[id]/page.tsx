"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FileText, Mail } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StageBadge, QuotationStatusBadge } from "@/components/ui/chips";
import { EmptyState } from "@/components/ui/misc";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { useCreateModals } from "@/components/forms/CreateModals";
import { ActivityTimeline } from "@/components/entities/ActivityTimeline";
import {
  CUSTOMER_TYPE_LABELS,
  CONTACT_METHOD_LABELS,
  SERVICE_LABELS,
} from "@/lib/labels";
import { money, formatDateRange, formatDate, relativeTime } from "@/lib/format";

const TABS = ["Overview", "Trips & enquiries", "Quotations", "Messages", "Documents", "Notes"] as const;
type Tab = (typeof TABS)[number];

export default function CustomerPage() {
  const params = useParams<{ id: string }>();
  const ws = useWorkspace();
  const { data } = ws;
  const customer = ws.customer(params.id);
  const { openCreate } = useCreateModals();
  const [tab, setTab] = useState<Tab>("Overview");

  if (!customer) {
    return <EmptyState title="Customer not found" hint="It may have been removed." />;
  }

  const consultant = ws.user(customer.assignedConsultantId);
  const enquiries = data.enquiries.filter((e) => e.customerId === customer.id);
  const quotations = data.quotations.filter((q) => q.customerId === customer.id);
  const conversations = data.conversations.filter((c) => c.customerId === customer.id);
  const documents = data.documents.filter((d) => d.customerId === customer.id);
  const activeEnquiry = enquiries.find((e) => e.status === "open");
  const outstanding = ws.customerOutstanding(customer.id);
  const activities = ws.activitiesFor({ customerId: customer.id });

  return (
    <div className="space-y-5">
      <Link href="/customers" className="text-sm text-muted hover:text-terracotta">← All customers</Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Avatar initials={customer.name.split(" ").map((p) => p[0]).slice(0, 2).join("")} seed={customer.id} size={48} />
            <div>
              <h1 className="text-xl font-bold">{customer.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="tnum">{customer.whatsapp}</span>
                {customer.email ? <span>{customer.email}</span> : null}
                <Badge tone="neutral">{CUSTOMER_TYPE_LABELS[customer.type]}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                Assigned to {consultant?.name} · Customer since {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <WhatsAppLink phone={customer.whatsapp} message={`Hello ${customer.name.split(" ")[0]},`} />
            <button className="btn btn-primary hover:btn-primary-hover" onClick={() => openCreate("quotation", customer.id)}>
              <FileText className="size-4" aria-hidden /> Create quotation
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === t ? "border-terracotta text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Details</h2>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Detail label="Preferred contact" value={CONTACT_METHOD_LABELS[customer.preferredContact]} />
                <Detail label="Customer type" value={CUSTOMER_TYPE_LABELS[customer.type]} />
                <Detail label="Traveller preferences" value={customer.preferences || "—"} wide />
                <Detail label="Previous destinations" value={customer.previousDestinations.length ? customer.previousDestinations.join(", ") : "None recorded"} wide />
              </dl>
            </div>
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Active enquiry</h2>
              {activeEnquiry ? (
                <Link href={`/enquiries/${activeEnquiry.id}`} className="row-hover -mx-2 flex items-center justify-between rounded-lg px-2 py-2">
                  <div>
                    <p className="font-medium">{activeEnquiry.destination}</p>
                    <p className="text-xs text-muted">{SERVICE_LABELS[activeEnquiry.service]} · Next: {activeEnquiry.nextActionLabel}</p>
                  </div>
                  <StageBadge stage={activeEnquiry.stage} />
                </Link>
              ) : (
                <p className="text-sm text-muted">No active enquiry.</p>
              )}
            </div>
          </div>
          <div className="space-y-5">
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Snapshot</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Outstanding balance</dt><dd className="tnum font-semibold">{outstanding > 0 ? money(outstanding) : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Open enquiries</dt><dd className="tnum">{enquiries.filter((e) => e.status === "open").length}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Quotations</dt><dd className="tnum">{quotations.length}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Next action</dt><dd className="text-right">{activeEnquiry ? formatDate(activeEnquiry.nextActionDate) : "—"}</dd></div>
              </dl>
            </div>
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Recent activity</h2>
              <ActivityTimeline activities={activities.slice(0, 6)} />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "Trips & enquiries" ? (
        <div className="card divide-y divide-line">
          {enquiries.length === 0 ? <p className="p-6 text-sm text-muted">No enquiries yet.</p> : enquiries.map((e) => (
            <Link key={e.id} href={`/enquiries/${e.id}`} className="row-hover flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">{e.ref} · {e.destination}</p>
                <p className="text-xs text-muted">{SERVICE_LABELS[e.service]} · {formatDateRange(e.travelStartDate, e.travelEndDate)}</p>
              </div>
              {e.status === "open" ? <StageBadge stage={e.stage} /> : <Badge tone={e.status === "lost" ? "error" : "neutral"}>{e.status}</Badge>}
            </Link>
          ))}
        </div>
      ) : null}

      {tab === "Quotations" ? (
        <div className="card divide-y divide-line">
          {quotations.length === 0 ? <p className="p-6 text-sm text-muted">No quotations yet.</p> : quotations.map((q) => (
            <Link key={q.id} href={`/quotations/${q.id}`} className="row-hover flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{q.ref} · {q.destination}</p>
                <p className="text-xs text-muted">Valid until {formatDate(q.validUntil)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tnum text-sm font-semibold">{money(ws.quotationTotal(q.id, q.selectedOptionLabel), q.currency)}</span>
                <QuotationStatusBadge status={q.status} />
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {tab === "Messages" ? (
        <div className="card divide-y divide-line">
          {conversations.length === 0 ? (
            <p className="p-6 text-sm text-muted">No WhatsApp conversations linked.</p>
          ) : conversations.map((c) => {
            const last = [...data.messages].filter((m) => m.conversationId === c.id).sort((a, b) => b.at.localeCompare(a.at))[0];
            return (
              <Link key={c.id} href="/whatsapp" className="row-hover flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{c.displayName}</p>
                  <p className="truncate text-xs text-muted">{last?.body ?? "No messages"}</p>
                </div>
                <span className="text-xs text-muted">{last ? relativeTime(last.at) : ""}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {tab === "Documents" ? (
        documents.length === 0 ? (
          <EmptyState title="No documents" hint="Quotations, invoices and vouchers attached to this customer will appear here." icon={<FileText className="size-6" />} />
        ) : (
          <div className="card divide-y divide-line">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted" aria-hidden />
                  <span className="text-sm font-medium">{d.name}</span>
                </div>
                <span className="text-xs capitalize text-muted">{d.kind} · {formatDate(d.uploadedAt)}</span>
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === "Notes" ? (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Internal notes across enquiries</h2>
          {enquiries.flatMap((e) => e.internalNotes).length === 0 ? (
            <p className="text-sm text-muted">No notes yet. Add notes from an enquiry page.</p>
          ) : (
            <ul className="space-y-3">
              {enquiries.flatMap((e) => e.internalNotes.map((n) => ({ n, e }))).sort((a, b) => b.n.at.localeCompare(a.n.at)).map(({ n, e }) => (
                <li key={n.id} className="rounded-lg border border-line p-3">
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{ws.user(n.authorId)?.name} · {relativeTime(n.at)} · {e.ref}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {customer.email ? (
        <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-terracotta">
          <Mail className="size-4" aria-hidden /> Email {customer.name.split(" ")[0]}
        </a>
      ) : null}
    </div>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
