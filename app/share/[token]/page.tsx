import { Compass } from "lucide-react";
import { createSeedData } from "@/lib/seed";
import { isSupabaseMode, getServiceSupabase } from "@/lib/supabase";
import { fetchShareQuotation } from "@/lib/db";
import { optionTotals, depositAmount, optionBadges, OPTION_BADGE_LABELS } from "@/lib/quotation";
import { QUOTATION_ITEM_LABELS } from "@/lib/labels";
import { money, formatDate, formatDateRange, travellersLabel } from "@/lib/format";
import { company, companyContactLine } from "@/lib/company";
import type { Customer, Quotation, QuotationItem, QuotationOption, User } from "@/lib/types";

/**
 * Public, read-only quotation view reached by the private share link. No
 * authentication and no CRM chrome — this is what a customer sees. Resolves
 * seeded demo quotations by share token.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Resolve the quotation, its options, items, customer and consultant either
  // from the live database (production) or the in-memory demo data.
  let q: Quotation | undefined;
  let customer: Customer | undefined;
  let consultant: User | undefined;
  let options: QuotationOption[] = [];
  let items: QuotationItem[] = [];

  const supa = isSupabaseMode() ? getServiceSupabase() : null;
  if (supa) {
    const resolved = await fetchShareQuotation(supa, token).catch(() => null);
    if (resolved) {
      q = resolved.quotation;
      customer = resolved.customer ?? undefined;
      consultant = resolved.consultant ?? undefined;
      // Only present options that actually have services — never an empty shell.
      options = resolved.options.filter((o) => resolved.items.some((i) => i.optionId === o.id));
      items = resolved.items;
    }
  } else {
    const seed = createSeedData();
    q = seed.quotations.find((x) => x.shareToken === token || x.id === token);
    if (q) {
      customer = seed.customers.find((c) => c.id === q!.customerId);
      consultant = seed.users.find((u) => u.id === q!.createdById);
      options = seed.quotationOptions
        .filter((o) => o.quotationId === q!.id)
        .filter((o) => seed.quotationItems.some((i) => i.optionId === o.id));
      items = seed.quotationItems;
    }
  }

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

  const gridCols = options.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
  const itemsFor = (id: string) => items.filter((i) => i.optionId === id);
  const badges = optionBadges(options, (id) => optionTotals(itemsFor(id)).total, itemsFor);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Compass className="size-6 text-terracotta" aria-hidden />
          <div>
            <span className="block text-lg font-bold leading-tight">{company.name}</span>
            <span className="block text-[11px] text-muted">{company.tagline}</span>
          </div>
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
          const optionItems = items.filter((i) => i.optionId === o.id);
          const t = optionTotals(optionItems);
          return (
            <section
              key={o.id}
              className={`card flex h-full flex-col p-5 ${o.recommended ? "ring-2 ring-terracotta" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-info">Option {o.label}</span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {(badges.get(o.id) ?? []).map((b) => (
                    <span key={b} className="text-xs font-semibold text-terracotta">
                      {OPTION_BADGE_LABELS[b]}
                    </span>
                  ))}
                </div>
              </div>
              <h2 className="mt-2 font-semibold">{o.name}</h2>
              {o.note ? <p className="mt-1 text-sm text-muted">{o.note}</p> : null}
              <ul className="mt-3 flex-1 divide-y divide-line text-sm">
                {optionItems.map((i) => (
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

      <footer className="mt-6 border-t border-line pt-4 text-center text-xs text-muted">
        <p className="font-semibold text-ink">{company.name}</p>
        <p className="mt-0.5">{companyContactLine()}</p>
        <p>{company.address}</p>
      </footer>
    </main>
  );
}
