"use client";

import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/ui/misc";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { company } from "@/lib/company";

/**
 * Settings shows company details, quotation defaults and staff access.
 * Editing is admin-only; consultants see a read-only view. In this demo the
 * fields are display-only placeholders (production persists to Supabase).
 */
export default function SettingsPage() {
  const { data, currentUser } = useWorkspace();
  const isAdmin = currentUser.role === "admin";

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Company details, quotation defaults and staff access." />

      {!isAdmin ? (
        <p className="rounded-lg border-l-2 border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
          You&apos;re signed in as a consultant — settings are read-only. Ask an administrator to make changes.
        </p>
      ) : null}

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Company</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Business name" value={company.name} />
          <Row label="Registered name" value={company.legalName} />
          <Row label="Base city" value={company.city} />
          <Row label="Default currency" value={company.currency} />
          <Row label="Phone / WhatsApp" value={company.phone} mono />
          <Row label="Support email" value={company.email} mono />
          <Row label="Website" value={company.website} mono />
          <Row label="Address" value={company.address} />
        </dl>
        <p className="mt-3 text-xs text-muted">
          These match the public website. Update them in <code className="rounded bg-surface-2 px-1 py-0.5">lib/company.ts</code> (and the website&apos;s <code className="rounded bg-surface-2 px-1 py-0.5">config/company.ts</code>) to keep both in sync.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Quotation defaults</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Default deposit" value="30%" />
          <Row label="Default validity" value="14 days" />
          <Row label="Standard exclusions" value="International flights · Travel insurance · Personal items" />
          <Row label="Footer terms" value="Prices subject to availability until confirmed in writing." />
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Staff access</h2>
        <ul className="divide-y divide-line">
          {data.users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-3">
              <Avatar initials={u.initials} seed={u.id} size={34} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{u.name}</p>
                <p className="text-xs text-muted">{u.email}</p>
              </div>
              <Badge tone={u.role === "admin" ? "info" : "neutral"}>{u.role === "admin" ? "Administrator" : "Consultant"}</Badge>
            </li>
          ))}
        </ul>
        {isAdmin ? <p className="mt-3 text-xs text-muted">Full staff-management (invites, deactivation) connects to Supabase Auth in production — see the README.</p> : null}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Supplier directory</h2>
          <Badge tone="neutral">Read-only in demo</Badge>
        </div>
        <p className="mb-4 text-sm text-muted">
          Reusable suppliers with contact, net rate and standard cancellation terms. Quotation
          items reference these instead of hand-typing terms — the on-ramp to hotel-contract
          management. Editing and new suppliers save once the database is connected.
        </p>
        <ul className="divide-y divide-line">
          {data.suppliers.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{s.name}</p>
                <Badge tone="neutral">{s.type}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted">{s.contact}</p>
              <p className="mt-1 text-xs text-muted">Net rate: {s.netRateNote}</p>
              <p className="text-xs text-muted">Cancellation: {s.standardCancellation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Data mode</h2>
        <p className="text-sm text-muted">
          Running in <strong className="text-ink">demo mode</strong> with in-memory sample data. Set{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">NEXT_PUBLIC_DATA_MODE=supabase</code> and configure Supabase
          keys to switch to the live backend.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
