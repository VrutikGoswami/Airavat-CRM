import { Compass } from "lucide-react";
import { createSeedData } from "@/lib/seed";
import { optionTotals, depositAmount } from "@/lib/quotation";
import { QUOTATION_ITEM_LABELS } from "@/lib/labels";
import { money, formatDate, formatDateRange, travellersLabel } from "@/lib/format";

/**
 * Public, read-only quotation view reached by the private share link. No
 * authentication and no CRM chrome — this is what a customer sees. Resolves
 * seeded demo quotations by share token.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const seed = createSeedData();
  const q = seed.quotations.find((x) => x.shareToken === token || x.id === token);

  if (!q) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-lg font-bold">Quotation link</h1>
          <p className="mt-2 text-sm text-muted">
            This shared quotation could not be found. It may have expired or been created in a
            different session. Please contact your travel consultant for an up-to-date link.
          </p>
        </div>
      </main>
    );
  }

  const customer = seed.customers.find((c) => c.id === q.customerId);
  const consultant = seed.users.find((u) => u.id === q.createdById);
  // Only present options that actually have services — never an empty shell.
  const options = seed.quotationOptions
    .filter((o) => o.quotationId === q.id)
    .filter((o) => seed.quotationItems.some((i) => i.optionId === o.id));
  const gridCols = options.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="size-6 text-terracotta" aria-hidden />
          <span className="text-lg font-bold">Airavat Tours &amp; Travels</span>
        </div>
        <span className="text-xs text-muted">Quotation {q.ref}</span>
      </header>

      <h1 className="text-2xl font-bold">{q.destination}</h1>
      <p className="mt-1 text-sm text-muted">
        Prepared for {customer?.name} · {formatDateRange(q.travelStartDate, q.travelEndDate)} · {travellersLabel(q.travellers)}
      </p>
      <p className="mt-1 text-xs text-muted">Valid until {formatDate(q.validUntil)}</p>

      {options.length > 1 ? (
        <p className="mt-6 text-sm font-medium">Compare your options side by side:</p>
      ) : null}
      <div className={`mt-3 grid items-start gap-4 ${gridCols}`}>
        {options.map((o) => {
          const items = seed.quotationItems.filter((i) => i.optionId === o.id);
          const t = optionTotals(items);
          return (
            <section
              key={o.id}
              className={`card flex h-full flex-col p-5 ${o.recommended ? "ring-2 ring-terracotta" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-info">Option {o.label}</span>
                {o.recommended ? <span className="text-xs font-semibold text-terracotta">Recommended</span> : null}
              </div>
              <h2 className="mt-2 font-semibold">{o.name}</h2>
              {o.note ? <p className="mt-1 text-sm text-muted">{o.note}</p> : null}
              <ul className="mt-3 flex-1 divide-y divide-line text-sm">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 py-2">
                    <span>{QUOTATION_ITEM_LABELS[i.type]} — {i.description}</span>
                    <span className="tnum text-muted">{money(i.sellingPrice * i.quantity, q.currency)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Total</span>
                  <span className="tnum font-bold">{money(t.total, q.currency)}</span>
                </div>
                <p className="tnum mt-1 text-sm text-muted">
                  Deposit to confirm ({q.depositPct}%): <strong className="text-ink">{money(depositAmount(t.total, q.depositPct), q.currency)}</strong>
                </p>
              </div>
            </section>
          );
        })}
      </div>

      <section className="card mt-4 p-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Not included</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {q.exclusions.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted">{q.terms}</p>
        <p className="mt-4 text-xs text-muted">
          Your consultant: {consultant?.name} · {consultant?.email}. This quotation is an offer of options and does not
          confirm supplier availability or issue tickets until booked and paid.
        </p>
      </section>
    </main>
  );
}
