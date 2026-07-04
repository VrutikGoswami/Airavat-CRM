"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/ui/misc";
import { QuotationStatusBadge } from "@/components/ui/chips";
import { useCreateModals } from "@/components/forms/CreateModals";
import { QUOTATION_STATUS_LABELS } from "@/lib/labels";
import { money, formatDate } from "@/lib/format";

export default function QuotationsPage() {
  const ws = useWorkspace();
  const { data } = ws;
  const { openCreate } = useCreateModals();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const [status, setStatus] = useState(
    initialStatus === "awaiting" || initialStatus in QUOTATION_STATUS_LABELS ? initialStatus : "",
  );

  const rows = useMemo(() => {
    return data.quotations.filter((q) => {
      if (status === "awaiting") return q.status === "sent" || q.status === "viewed";
      if (status) return q.status === status;
      return true;
    });
  }, [data.quotations, status]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotations"
        subtitle={`${data.quotations.length} quotations`}
        actions={
          <button className="btn btn-primary hover:btn-primary-hover" onClick={() => openCreate("quotation")}>
            <Plus className="size-4" aria-hidden /> New quotation
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <select className="field max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="awaiting">Awaiting customer reply</option>
          {Object.entries(QUOTATION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-semibold">Reference</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Destination</th>
                <th className="px-4 py-2.5 font-semibold">Valid until</th>
                <th className="px-4 py-2.5 font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((q) => {
                const c = data.customers.find((x) => x.id === q.customerId);
                return (
                  <tr key={q.id} className="row-hover">
                    <td className="px-4 py-3">
                      <Link href={`/quotations/${q.id}`} className="font-medium hover:text-terracotta">{q.ref}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{c?.name}</td>
                    <td className="px-4 py-3 text-muted">{q.destination}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(q.validUntil)}</td>
                    <td className="tnum px-4 py-3 font-semibold">{money(ws.quotationTotal(q.id, q.selectedOptionLabel), q.currency)}</td>
                    <td className="px-4 py-3"><QuotationStatusBadge status={q.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-muted">No quotations match.</p> : null}
      </div>
    </div>
  );
}
