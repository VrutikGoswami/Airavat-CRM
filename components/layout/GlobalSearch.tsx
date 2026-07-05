"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace";

type Result = { href: string; label: string; sub: string; kind: string };

/** Global search across customers, enquiries, quotations, bookings, phones. */
export function GlobalSearch() {
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    // Raw phone numbers arrive with spaces/+/-; match on digits only.
    const digits = query.replace(/[^0-9]/g, "");
    const phoneHit = (value: string) => digits.length >= 3 && value.replace(/[^0-9]/g, "").includes(digits);
    if (q.length < 2 && digits.length < 3) return [];
    const out: Result[] = [];
    for (const c of data.customers) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.whatsapp.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        phoneHit(c.whatsapp)
      ) {
        out.push({ href: `/customers/${c.id}`, label: c.name, sub: c.whatsapp, kind: "Customer" });
      }
    }
    for (const e of data.enquiries) {
      const cust = data.customers.find((c) => c.id === e.customerId);
      if (e.ref.toLowerCase().includes(q) || e.destination.toLowerCase().includes(q) || cust?.name.toLowerCase().includes(q)) {
        out.push({ href: `/enquiries/${e.id}`, label: `${e.ref} · ${e.destination}`, sub: cust?.name ?? "", kind: "Enquiry" });
      }
    }
    for (const qt of data.quotations) {
      if (qt.ref.toLowerCase().includes(q) || qt.destination.toLowerCase().includes(q)) {
        out.push({ href: `/quotations/${qt.id}`, label: `${qt.ref} · ${qt.destination}`, sub: "Quotation", kind: "Quotation" });
      }
    }
    for (const b of data.bookings) {
      if (b.ref.toLowerCase().includes(q) || b.destination.toLowerCase().includes(q) || (b.amadeusPnr ?? "").toLowerCase().includes(q)) {
        out.push({ href: `/bookings/${b.id}`, label: `${b.ref} · ${b.destination}`, sub: "Booking", kind: "Booking" });
      }
    }
    // WhatsApp conversations — matches raw numbers, incl. leads not yet named.
    for (const conv of data.conversations) {
      if (phoneHit(conv.phone) || conv.phone.toLowerCase().includes(q) || conv.displayName.toLowerCase().includes(q)) {
        out.push({
          href: `/whatsapp?c=${conv.id}`,
          label: conv.displayName,
          sub: conv.customerId ? "WhatsApp conversation" : "WhatsApp · new number",
          kind: "WhatsApp",
        });
      }
    }
    return out.slice(0, 8);
  }, [query, data]);

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search customers, trips, quotations, phone…"
        aria-label="Global search"
        className="field pl-8"
      />
      {open && results.length > 0 ? (
        <ul className="scroll-thin absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-[10px] border border-line bg-surface py-1" style={{ boxShadow: "var(--shadow-pop)" }}>
          {results.map((r) => (
            <li key={r.href + r.label}>
              <Link href={r.href} className="row-hover flex items-center justify-between gap-2 px-3 py-2 text-sm" onMouseDown={(e) => e.preventDefault()}>
                <span>
                  <span className="font-medium">{r.label}</span>
                  {r.sub ? <span className="block text-xs text-muted">{r.sub}</span> : null}
                </span>
                <span className="badge badge-neutral">{r.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= 2 && results.length === 0 ? (
        <div className="absolute z-50 mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-3 text-sm text-muted" style={{ boxShadow: "var(--shadow-pop)" }}>
          No matches for “{query}”.
        </div>
      ) : null}
    </div>
  );
}
