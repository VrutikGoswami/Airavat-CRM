"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckSquare, FileText, StickyNote, XCircle } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StageBadge, WaitingOnPill } from "@/components/ui/chips";
import { EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { useCreateModals } from "@/components/forms/CreateModals";
import { ActivityTimeline } from "@/components/entities/ActivityTimeline";
import {
  LEAD_SOURCE_LABELS,
  LOST_REASON_LABELS,
  PIPELINE_STAGES,
  SERVICE_LABELS,
  WAITING_ON_LABELS,
} from "@/lib/labels";
import { formatDateRange, money, relativeTime, travellersLabel } from "@/lib/format";
import type { LostReason, PipelineStage, WaitingOn } from "@/lib/types";

export default function EnquiryPage() {
  const params = useParams<{ id: string }>();
  const ws = useWorkspace();
  const enquiry = ws.enquiry(params.id);
  const { openCreate } = useCreateModals();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState<LostReason>("no-response");

  if (!enquiry) return <EmptyState title="Enquiry not found" />;

  const customer = ws.customer(enquiry.customerId);
  const consultant = ws.user(enquiry.assignedConsultantId);
  const activities = ws.activitiesFor({ enquiryId: enquiry.id, customerId: enquiry.customerId });
  const quotations = ws.data.quotations.filter((q) => q.enquiryId === enquiry.id);

  const facts: { label: string; value: string }[] = [
    { label: "Service", value: SERVICE_LABELS[enquiry.service] },
    { label: "Route", value: `${enquiry.origin || "—"} → ${enquiry.destination}` },
    { label: "Travel dates", value: `${formatDateRange(enquiry.travelStartDate, enquiry.travelEndDate)}${enquiry.datesFlexible ? " (flexible)" : ""}` },
    { label: "Travellers", value: travellersLabel(enquiry.travellers) },
    { label: "Budget", value: enquiry.budget || "—" },
    { label: "Estimated value", value: money(enquiry.estimatedValue) },
    { label: "Lead source", value: LEAD_SOURCE_LABELS[enquiry.leadSource] },
    { label: "Next action", value: enquiry.nextActionLabel },
  ];

  return (
    <div className="space-y-5">
      <Link href="/pipeline" className="text-sm text-muted hover:text-terracotta">← Pipeline</Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">{enquiry.ref}</span>
              {enquiry.status === "open" ? <StageBadge stage={enquiry.stage} /> : <Badge tone={enquiry.status === "lost" ? "error" : "neutral"}>{enquiry.status}</Badge>}
            </div>
            <h1 className="mt-1 text-xl font-bold">
              <Link href={`/customers/${customer?.id}`} className="hover:text-terracotta">{customer?.name}</Link>
              <span className="font-normal text-muted"> · {enquiry.destination}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <WaitingOnPill waitingOn={enquiry.waitingOn} />
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <Avatar initials={consultant?.initials ?? "?"} seed={consultant?.id} size={18} /> {consultant?.name}
              </span>
            </div>
          </div>
          {customer ? <WhatsAppLink phone={customer.whatsapp} message={`Hello ${customer.name.split(" ")[0]}, regarding your ${enquiry.destination} enquiry —`} /> : null}
        </div>

        {/* Actions */}
        {enquiry.status === "open" ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <button className="btn btn-primary hover:btn-primary-hover" onClick={() => openCreate("quotation", enquiry.customerId)}>
              <FileText className="size-4" aria-hidden /> Build quotation
            </button>
            <button className="btn btn-ghost" onClick={() => openCreate("task", enquiry.customerId)}>
              <CheckSquare className="size-4" aria-hidden /> Add task
            </button>
            <button className="btn btn-ghost" onClick={() => setNoteOpen(true)}>
              <StickyNote className="size-4" aria-hidden /> Add note
            </button>
            <button className="btn btn-ghost text-error" onClick={() => setLostOpen(true)}>
              <XCircle className="size-4" aria-hidden /> Mark lost
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: details */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Enquiry details</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{f.label}</dt>
                  <dd className="mt-0.5 text-sm">{f.value}</dd>
                </div>
              ))}
            </dl>
            {enquiry.requirements ? (
              <div className="mt-4 border-t border-line pt-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Requirements</dt>
                <dd className="mt-1 text-sm leading-relaxed">{enquiry.requirements}</dd>
              </div>
            ) : null}
          </div>

          {/* Stage + waiting controls */}
          {enquiry.status === "open" ? (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Pipeline stage</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">Stage</span>
                  <select className="field" value={enquiry.stage} onChange={(e) => ws.moveEnquiryStage(enquiry.id, e.target.value as PipelineStage)}>
                    {PIPELINE_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">Waiting on</span>
                  <select className="field" value={enquiry.waitingOn} onChange={(e) => ws.setWaitingOn(enquiry.id, e.target.value as WaitingOn)}>
                    {(Object.keys(WAITING_ON_LABELS) as WaitingOn[]).map((w) => <option key={w} value={w}>{WAITING_ON_LABELS[w]}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ) : enquiry.lostReason ? (
            <div className="card p-5">
              <p className="text-sm"><span className="font-semibold">Marked lost:</span> {LOST_REASON_LABELS[enquiry.lostReason]}</p>
            </div>
          ) : null}

          {/* Linked quotations */}
          {quotations.length > 0 ? (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Quotations</h2>
              <div className="divide-y divide-line">
                {quotations.map((q) => (
                  <Link key={q.id} href={`/quotations/${q.id}`} className="row-hover -mx-2 flex items-center justify-between rounded-lg px-2 py-2">
                    <span className="text-sm font-medium">{q.ref}</span>
                    <span className="tnum text-sm">{money(ws.quotationTotal(q.id, q.selectedOptionLabel), q.currency)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* Notes */}
          {enquiry.internalNotes.length > 0 ? (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Internal notes</h2>
              <ul className="space-y-3">
                {[...enquiry.internalNotes].reverse().map((n) => (
                  <li key={n.id} className="rounded-lg border border-line p-3">
                    <p className="text-sm">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">{ws.user(n.authorId)?.name} · {relativeTime(n.at)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Right: timeline */}
        <div className="card h-fit p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Activity timeline</h2>
          <ActivityTimeline activities={activities} />
        </div>
      </div>

      {/* Add note modal */}
      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add internal note"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setNoteOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary hover:btn-primary-hover"
              onClick={() => { if (noteBody.trim()) { ws.addNote(enquiry.id, noteBody.trim()); setNoteBody(""); setNoteOpen(false); } }}
            >
              Save note
            </button>
          </>
        }
      >
        <textarea className="field" rows={4} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add context for the team…" />
      </Modal>

      {/* Mark lost modal */}
      <Modal
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        title="Mark enquiry as lost"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setLostOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary hover:btn-primary-hover"
              style={{ background: "var(--color-error)" }}
              onClick={() => { ws.markEnquiryLost(enquiry.id, lostReason); setLostOpen(false); }}
            >
              Mark lost
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">Choose a reason. This moves the enquiry to the archive.</p>
        <div className="space-y-1.5">
          {(Object.keys(LOST_REASON_LABELS) as LostReason[]).map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="lost-reason" checked={lostReason === r} onChange={() => setLostReason(r)} className="accent-[var(--color-terracotta)]" />
              {LOST_REASON_LABELS[r]}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
