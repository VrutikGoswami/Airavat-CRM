"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/ui/misc";
import { BookingStatusBadge } from "@/components/ui/chips";
import { BOOKING_STATUS_LABELS } from "@/lib/labels";
import { money, formatDateRange } from "@/lib/format";

export default function BookingsPage() {
  const ws = useWorkspace();
  const { data } = ws;
  const [status, setStatus] = useState("");
  const [outstandingOnly, setOutstandingOnly] = useState(false);

  const rows = useMemo(() => {
    return data.bookings.filter((b) => {
      if (status && b.status !== status) return false;
      if (outstandingOnly && ws.outstandingFor(b) <= 0) return false;
      return true;
    });
  }, [data.bookings, status, outstandingOnly, ws]);

  const totalOutstanding = data.bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + ws.outstandingFor(b), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Bookings" subtitle={`${data.bookings.length} bookings · ${money(totalOutstanding)} outstanding`} />

      <div className="flex flex-wrap gap-2">
        <select className="field max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(BOOKING_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-[var(--color-terracotta)]" checked={outstandingOnly} onChange={(e) => setOutstandingOnly(e.target.checked)} />
          Outstanding balance only
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-semibold">Reference</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Destination</th>
                <th className="px-4 py-2.5 font-semibold">Travel dates</th>
                <th className="px-4 py-2.5 font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Outstanding</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((b) => {
                const c = data.customers.find((x) => x.id === b.customerId);
                const out = ws.outstandingFor(b);
                return (
                  <tr key={b.id} className="row-hover">
                    <td className="px-4 py-3"><Link href={`/bookings/${b.id}`} className="font-medium hover:text-terracotta">{b.ref}</Link></td>
                    <td className="px-4 py-3 text-muted">{c?.name}</td>
                    <td className="px-4 py-3 text-muted">{b.destination}</td>
                    <td className="px-4 py-3 text-muted">{formatDateRange(b.travelStartDate, b.travelEndDate)}</td>
                    <td className="tnum px-4 py-3">{money(b.totalSelling)}</td>
                    <td className="tnum px-4 py-3 font-semibold" style={out > 0 ? { color: "var(--color-warning)" } : undefined}>{out > 0 ? money(out) : "Paid"}</td>
                    <td className="px-4 py-3"><BookingStatusBadge status={b.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-muted">No bookings match.</p> : null}
      </div>
    </div>
  );
}
