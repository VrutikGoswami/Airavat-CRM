"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useCreateModals } from "@/components/forms/CreateModals";
import { CUSTOMER_TYPE_LABELS } from "@/lib/labels";
import { money } from "@/lib/format";

export default function CustomersPage() {
  const ws = useWorkspace();
  const { data } = ws;
  const { openCreate } = useCreateModals();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.customers.filter((c) => {
      if (type && c.type !== type) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.whatsapp.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    });
  }, [data.customers, query, type]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle={`${data.customers.length} customer records`}
        actions={
          <button className="btn btn-primary hover:btn-primary-hover" onClick={() => openCreate("customer")}>
            <Plus className="size-4" aria-hidden /> New customer
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder="Search name, phone or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="field max-w-[180px]" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {Object.entries(CUSTOMER_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">WhatsApp</th>
                <th className="px-4 py-2.5 font-semibold">Consultant</th>
                <th className="px-4 py-2.5 font-semibold">Open enquiries</th>
                <th className="px-4 py-2.5 font-semibold">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => {
                const consultant = data.users.find((u) => u.id === c.assignedConsultantId);
                const open = data.enquiries.filter((e) => e.customerId === c.id && e.status === "open").length;
                const outstanding = ws.customerOutstanding(c.id);
                return (
                  <tr key={c.id} className="row-hover">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-2 font-medium hover:text-terracotta">
                        <Avatar initials={c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")} seed={c.id} size={26} />
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><Badge tone="neutral">{CUSTOMER_TYPE_LABELS[c.type]}</Badge></td>
                    <td className="tnum px-4 py-3 text-muted">{c.whatsapp}</td>
                    <td className="px-4 py-3 text-muted">{consultant?.name.split(" ")[0]}</td>
                    <td className="tnum px-4 py-3">{open}</td>
                    <td className="tnum px-4 py-3">{outstanding > 0 ? money(outstanding) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-muted">No customers match your search.</p> : null}
      </div>
    </div>
  );
}
