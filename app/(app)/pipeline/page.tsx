"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type DragEvent } from "react";
import { MessageSquare } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/ui/misc";
import { ServiceBadge, WaitingOnPill } from "@/components/ui/chips";
import { Avatar } from "@/components/ui/Avatar";
import { PIPELINE_STAGES, SERVICE_LABELS, LOST_REASON_LABELS } from "@/lib/labels";
import { shortMoney, formatDateRange, travellersTotal, isOverdue } from "@/lib/format";
import type { Enquiry, PipelineStage } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PipelinePage() {
  const ws = useWorkspace();
  const { data } = ws;
  const searchParams = useSearchParams();
  const [view, setView] = useState<"board" | "archive">("board");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<PipelineStage | null>(null);

  const initialStage = searchParams.get("stage");
  const [fStage, setFStage] = useState(
    PIPELINE_STAGES.some((s) => s.id === initialStage) ? (initialStage as PipelineStage) : "",
  );
  const [fConsultant, setFConsultant] = useState("");
  const [fService, setFService] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fWaiting, setFWaiting] = useState("");
  const [fOverdue, setFOverdue] = useState(false);

  const openEnquiries = useMemo(() => {
    return data.enquiries.filter((e) => {
      if (e.status !== "open") return false;
      if (fConsultant && e.assignedConsultantId !== fConsultant) return false;
      if (fService && e.service !== fService) return false;
      if (fWaiting && e.waitingOn !== fWaiting) return false;
      if (fMonth && e.travelStartDate.slice(5, 7) !== fMonth) return false;
      if (fOverdue && !isOverdue(e.nextActionDate)) return false;
      return true;
    });
  }, [data.enquiries, fConsultant, fService, fMonth, fWaiting, fOverdue]);

  const byStage = (stage: PipelineStage) => openEnquiries.filter((e) => e.stage === stage);
  const archived = data.enquiries.filter((e) => e.status !== "open");
  const visibleStages = fStage
    ? PIPELINE_STAGES.filter((stage) => stage.id === fStage)
    : PIPELINE_STAGES;

  const onDrop = (stage: PipelineStage) => {
    if (dragId) ws.moveEnquiryStage(dragId, stage);
    setDragId(null);
    setDropStage(null);
  };

  const selectCls = "field py-1.5 text-xs";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline"
        subtitle="Drag enquiries between stages as they progress. Click a card to open it."
        actions={
          <div className="flex rounded-lg border border-line p-0.5">
            <button
              type="button"
              onClick={() => setView("board")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "board" ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setView("archive")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "archive" ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              Completed &amp; lost
            </button>
          </div>
        }
      />

      {view === "board" ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select className={selectCls} value={fStage} onChange={(e) => setFStage(e.target.value)} aria-label="Filter by pipeline stage">
              <option value="">All stages</option>
              {PIPELINE_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
            </select>
            <select className={selectCls} value={fConsultant} onChange={(e) => setFConsultant(e.target.value)} aria-label="Filter by consultant">
              <option value="">All consultants</option>
              {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select className={selectCls} value={fService} onChange={(e) => setFService(e.target.value)} aria-label="Filter by service">
              <option value="">All services</option>
              {Object.entries(SERVICE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className={selectCls} value={fMonth} onChange={(e) => setFMonth(e.target.value)} aria-label="Filter by travel month">
              <option value="">Any month</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
            <select className={selectCls} value={fWaiting} onChange={(e) => setFWaiting(e.target.value)} aria-label="Filter by waiting on">
              <option value="">Waiting: anyone</option>
              <option value="team">Our team</option>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
              <option value="none">No one</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input type="checkbox" className="size-4 accent-[var(--color-terracotta)]" checked={fOverdue} onChange={(e) => setFOverdue(e.target.checked)} />
              Overdue only
            </label>
            {(fStage || fConsultant || fService || fMonth || fWaiting || fOverdue) ? (
              <button type="button" className="text-xs font-semibold text-terracotta" onClick={() => { setFStage(""); setFConsultant(""); setFService(""); setFMonth(""); setFWaiting(""); setFOverdue(false); }}>
                Clear
              </button>
            ) : null}
          </div>

          {/* Board */}
          <div className="scroll-thin -mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
            <div className="flex gap-3" style={{ minWidth: "min-content" }}>
              {visibleStages.map((stage) => {
                const cards = byStage(stage.id);
                const value = cards.reduce((s, e) => s + ws.enquiryValueKes(e.id), 0);
                return (
                  <div
                    key={stage.id}
                    className={`flex w-72 shrink-0 flex-col rounded-[12px] border ${dropStage === stage.id ? "border-terracotta bg-surface-2" : "border-line bg-surface-2/40"}`}
                    onDragOver={(e) => { e.preventDefault(); setDropStage(stage.id); }}
                    onDragLeave={() => setDropStage((s) => (s === stage.id ? null : s))}
                    onDrop={() => onDrop(stage.id)}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <h2 className="text-xs font-bold uppercase tracking-wide">{stage.label}</h2>
                      <span className="tnum text-xs text-muted">{cards.length}</span>
                    </div>
                    <p className="tnum -mt-1.5 px-3 pb-2 text-[11px] text-muted">{shortMoney(value)}</p>
                    <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "calc(100svh - 320px)", minHeight: 80 }}>
                      {cards.map((e) => (
                        <PipelineCard
                          key={e.id}
                          enquiry={e}
                          dragging={dragId === e.id}
                          onDragStart={(ev) => { ev.dataTransfer.effectAllowed = "move"; setDragId(e.id); }}
                          onDragEnd={() => { setDragId(null); setDropStage(null); }}
                        />
                      ))}
                      {cards.length === 0 ? <p className="px-2 py-4 text-center text-xs text-muted">—</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted">
            Tip: drag a card to a new column to change its stage. On touch devices, open a card and use “Change stage”.
          </p>
        </>
      ) : (
        <ArchiveView enquiries={archived} />
      )}
    </div>
  );
}

function PipelineCard({
  enquiry,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  enquiry: Enquiry;
  dragging: boolean;
  onDragStart: (e: DragEvent<HTMLAnchorElement>) => void;
  onDragEnd: () => void;
}) {
  const ws = useWorkspace();
  const customer = ws.customer(enquiry.customerId);
  const consultant = ws.user(enquiry.assignedConsultantId);
  const conv = ws.data.conversations.find((c) => c.enquiryId === enquiry.id);
  const overdue = isOverdue(enquiry.nextActionDate);

  return (
    <Link
      href={`/enquiries/${enquiry.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`block cursor-grab rounded-[10px] border border-line bg-surface p-2.5 active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight">{customer?.name}</span>
        {conv && conv.unreadCount > 0 ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-terracotta px-1.5 py-0.5 text-[10px] font-bold text-white">
            <MessageSquare className="size-3" aria-hidden />
            {conv.unreadCount}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-muted">{enquiry.destination}</p>
      <div className="mt-1.5"><ServiceBadge service={enquiry.service} /></div>
      <p className="mt-1 text-xs text-muted">{formatDateRange(enquiry.travelStartDate, enquiry.travelEndDate)}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="tnum text-xs font-semibold">{shortMoney(ws.enquiryValueKes(enquiry.id))}</span>
        <span className="text-[11px] text-muted">{travellersTotal(enquiry.travellers)} pax</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <WaitingOnPill waitingOn={enquiry.waitingOn} />
        <span title={consultant?.name}><Avatar initials={consultant?.initials ?? "?"} seed={consultant?.id} size={18} /></span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        <span>Next: {enquiry.nextActionLabel}</span>
        {overdue ? <span className="ml-1 font-semibold text-warning">· overdue</span> : null}
      </p>
    </Link>
  );
}

function ArchiveView({ enquiries }: { enquiries: Enquiry[] }) {
  const ws = useWorkspace();
  if (enquiries.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">No completed or lost enquiries yet.</p>;
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-semibold">Customer</th>
              <th className="px-4 py-2.5 font-semibold">Destination</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Reason</th>
              <th className="px-4 py-2.5 font-semibold">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {enquiries.map((e) => {
              const c = ws.customer(e.customerId);
              return (
                <tr key={e.id} className="row-hover">
                  <td className="px-4 py-3">
                    <Link href={`/enquiries/${e.id}`} className="font-medium hover:text-terracotta">{c?.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{e.destination}</td>
                  <td className="px-4 py-3 capitalize">{e.status}</td>
                  <td className="px-4 py-3 text-muted">{e.lostReason ? LOST_REASON_LABELS[e.lostReason] : "—"}</td>
                  <td className="tnum px-4 py-3">{shortMoney(e.estimatedValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
