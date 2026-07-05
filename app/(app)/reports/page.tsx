"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader, StatTile } from "@/components/ui/misc";
import { LEAD_SOURCE_LABELS, LOST_REASON_LABELS } from "@/lib/labels";
import { FINANCIAL_BASIS_LABEL } from "@/lib/booking";
import { money, REFERENCE_TODAY, formatDate } from "@/lib/format";
import type { LeadSource, LostReason } from "@/lib/types";

const REF_YEAR = Number(REFERENCE_TODAY.slice(0, 4));
const REF_MONTH = Number(REFERENCE_TODAY.slice(5, 7)); // 1-12
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

type Preset = { id: string; label: string; from: string; to: string };
const PRESETS: Preset[] = (() => {
  const qStart = Math.floor((REF_MONTH - 1) / 3) * 3 + 1;
  const qEnd = qStart + 2;
  return [
    { id: "all", label: "All time", from: "", to: "" },
    { id: "month", label: "This month", from: iso(REF_YEAR, REF_MONTH, 1), to: iso(REF_YEAR, REF_MONTH, lastDayOfMonth(REF_YEAR, REF_MONTH)) },
    { id: "quarter", label: "This quarter", from: iso(REF_YEAR, qStart, 1), to: iso(REF_YEAR, qEnd, lastDayOfMonth(REF_YEAR, qEnd)) },
    { id: "year", label: "This year", from: iso(REF_YEAR, 1, 1), to: iso(REF_YEAR, 12, 31) },
  ];
})();

function Bar({ label, value, max, valueLabel }: { label: string; value: number; max: number; valueLabel?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tnum font-semibold">{valueLabel ?? value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-terracotta" style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const ws = useWorkspace();
  const { data } = ws;
  const [consultant, setConsultant] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const activePreset =
    PRESETS.find((p) => p.from === from && p.to === to)?.id ?? (from || to ? "custom" : "all");

  // Everything is filtered by booked/created date within [from, to] so the
  // period metrics use one explicit basis (see FINANCIAL_BASIS_LABEL).
  const scope = useMemo(() => {
    const inRange = (isoDate: string) => {
      const d = isoDate.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    const enquiries = data.enquiries.filter(
      (e) => (!consultant || e.assignedConsultantId === consultant) && inRange(e.createdAt),
    );
    const bookings = data.bookings.filter(
      (b) => (!consultant || b.assignedConsultantId === consultant) && inRange(b.createdAt),
    );
    const quotations = data.quotations.filter(
      (q) => (!consultant || q.createdById === consultant) && inRange(q.createdAt),
    );
    return { enquiries, bookings, quotations };
  }, [data, consultant, from, to]);

  const bySource = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of scope.enquiries) counts[e.leadSource] = (counts[e.leadSource] ?? 0) + 1;
    return counts;
  }, [scope.enquiries]);

  const lostReasons = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of scope.enquiries.filter((e) => e.status === "lost" && e.lostReason)) {
      counts[e.lostReason as string] = (counts[e.lostReason as string] ?? 0) + 1;
    }
    return counts;
  }, [scope.enquiries]);

  const totalEnquiries = scope.enquiries.length;
  const bookedEnquiries = scope.enquiries.filter((e) => scope.bookings.some((b) => b.enquiryId === e.id)).length;
  const conversion = totalEnquiries > 0 ? Math.round((bookedEnquiries / totalEnquiries) * 100) : 0;

  const decidedQuotes = scope.quotations.filter((q) => ["accepted", "declined"].includes(q.status));
  const acceptedQuotes = scope.quotations.filter((q) => q.status === "accepted");
  const acceptanceRate = decidedQuotes.length > 0 ? Math.round((acceptedQuotes.length / decidedQuotes.length) * 100) : 0;

  const confirmedValue = scope.bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.totalSelling, 0);
  const grossProfit = scope.bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + (b.totalSelling - b.totalCost), 0);
  const outstanding = scope.bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + ws.outstandingFor(b), 0);

  const workload = data.users.map((u) => ({
    user: u,
    open: data.enquiries.filter((e) => e.assignedConsultantId === u.id && e.status === "open").length,
    tasks: data.tasks.filter((t) => t.assignedToId === u.id && !t.done).length,
  }));
  const maxWorkload = Math.max(1, ...workload.map((w) => w.open + w.tasks));
  const maxSource = Math.max(1, ...Object.values(bySource));
  const maxLost = Math.max(1, ...Object.values(lostReasons));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="A simple read on how the business is performing."
        actions={
          <select className="field max-w-[200px]" value={consultant} onChange={(e) => setConsultant(e.target.value)} aria-label="Filter by consultant">
            <option value="">Whole team</option>
            {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        }
      />

      {/* Date-range filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setFrom(p.from); setTo(p.to); }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${activePreset === p.id ? "border-terracotta bg-surface text-ink shadow-sm" : "border-line text-muted"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="text-xs font-semibold text-muted">
          From
          <input type="date" className="field mt-1 py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-semibold text-muted">
          To
          <input type="date" className="field mt-1 py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-muted">
        Financial figures are {FINANCIAL_BASIS_LABEL}
        {from || to ? ` · ${from ? formatDate(from) : "start"} → ${to ? formatDate(to) : "today"}` : " · all time"}.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Conversion rate" value={`${conversion}%`} hint={`${bookedEnquiries}/${totalEnquiries} enquiries booked`} />
        <StatTile label="Quotation acceptance" value={`${acceptanceRate}%`} hint={`${acceptedQuotes.length}/${decidedQuotes.length} decided`} />
        <StatTile label="Confirmed value" value={money(confirmedValue)} hint={`Non-cancelled · ${FINANCIAL_BASIS_LABEL}`} />
        <StatTile label="Gross profit" value={money(grossProfit)} hint={`Selling − cost · ${FINANCIAL_BASIS_LABEL}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Enquiries by source</h2>
          <div className="space-y-3">
            {Object.keys(bySource).length === 0 ? <p className="text-sm text-muted">No enquiries in scope.</p> : (Object.entries(bySource) as [LeadSource, number][]).map(([s, n]) => (
              <Bar key={s} label={LEAD_SOURCE_LABELS[s]} value={n} max={maxSource} />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Lost enquiry reasons</h2>
          <div className="space-y-3">
            {Object.keys(lostReasons).length === 0 ? <p className="text-sm text-muted">No lost enquiries — nice.</p> : (Object.entries(lostReasons) as [LostReason, number][]).map(([r, n]) => (
              <Bar key={r} label={LOST_REASON_LABELS[r]} value={n} max={maxLost} />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Outstanding balances</h2>
          <p className="tnum text-2xl font-bold" style={{ color: outstanding > 0 ? "var(--color-warning)" : "var(--color-success)" }}>{money(outstanding)}</p>
          <p className="mt-1 text-sm text-muted">Across {scope.bookings.filter((b) => ws.outstandingFor(b) > 0).length} booking(s) awaiting payment.</p>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Consultant workload</h2>
          <div className="space-y-3">
            {workload.map((w) => (
              <Bar key={w.user.id} label={w.user.name} value={w.open + w.tasks} max={maxWorkload} valueLabel={`${w.open} enquiries · ${w.tasks} tasks`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
