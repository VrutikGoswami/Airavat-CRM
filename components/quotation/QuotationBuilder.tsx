"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { Field } from "@/components/forms/Field";
import { sellingFromMarkup, depositAmount } from "@/lib/quotation";
import { money, dateFromToday, formatDateRange } from "@/lib/format";
import { QUOTATION_ITEM_LABELS } from "@/lib/labels";
import type { Currency, QuotationItemType } from "@/lib/types";

type BuilderItem = {
  key: string;
  optionLabel: "A" | "B" | "C";
  type: QuotationItemType;
  supplier: string;
  description: string;
  startDate: string;
  endDate: string;
  quantity: number;
  costPrice: number;
  markupPct: number;
  sellingPrice: number;
  taxPct: number;
  notes: string;
  cancellation: string;
};

type BuilderOption = { label: "A" | "B" | "C"; name: string; note: string };

const STEPS = ["Trip details", "Add services", "Options", "Review", "Send"];

let keyCounter = 0;
const nextKey = () => `it-${keyCounter++}`;

export function QuotationBuilder() {
  const ws = useWorkspace();
  const { data, currentUser } = ws;
  const router = useRouter();
  const params = useSearchParams();

  const presetCustomer = params.get("customer") ?? data.customers[0]?.id ?? "";
  const presetEnquiry = params.get("enquiry") ?? "";
  const linkedEnquiry = data.enquiries.find(
    (e) => e.id === presetEnquiry || (e.customerId === presetCustomer && e.status === "open"),
  );

  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState(presetCustomer);
  const [destination, setDestination] = useState(linkedEnquiry?.destination ?? "");
  const [startDate, setStartDate] = useState(linkedEnquiry?.travelStartDate ?? "");
  const [endDate, setEndDate] = useState(linkedEnquiry?.travelEndDate ?? "");
  const [adults, setAdults] = useState(linkedEnquiry?.travellers.adults ?? 2);
  const [children, setChildren] = useState(linkedEnquiry?.travellers.children ?? 0);
  const [infants, setInfants] = useState(linkedEnquiry?.travellers.infants ?? 0);
  const [currency, setCurrency] = useState<Currency>("KES");
  const [validUntil, setValidUntil] = useState(dateFromToday(14));
  const [depositPct, setDepositPct] = useState(30);
  const [exclusionsText, setExclusionsText] = useState("International flights\nTravel insurance\nItems of a personal nature");
  const [terms, setTerms] = useState("Prices are subject to availability at the time of booking. A deposit confirms the booking; the balance is due before travel. This quotation does not guarantee supplier availability until confirmed in writing.");

  const [options, setOptions] = useState<BuilderOption[]>([{ label: "A", name: "Recommended option", note: "" }]);
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const optionLabels = options.map((o) => o.label);

  const totalsForOption = (label: "A" | "B" | "C") => {
    const list = items.filter((i) => i.optionLabel === label);
    let cost = 0, sell = 0, tax = 0;
    for (const it of list) {
      const s = it.sellingPrice * it.quantity;
      cost += it.costPrice * it.quantity;
      sell += s;
      tax += (s * it.taxPct) / 100;
    }
    return { cost, sellingExTax: sell, tax, total: sell + tax, margin: sell - cost };
  };

  const primaryLabel = optionLabels[0] ?? "A";
  const primaryTotals = totalsForOption(primaryLabel);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { key: nextKey(), optionLabel: primaryLabel, type: "hotel", supplier: "", description: "", startDate: "", endDate: "", quantity: 1, costPrice: 0, markupPct: 15, sellingPrice: 0, taxPct: 0, notes: "", cancellation: "" },
    ]);
  };

  const updateItem = (key: string, patch: Partial<BuilderItem>) => {
    setItems((prev) => prev.map((i) => {
      if (i.key !== key) return i;
      const merged = { ...i, ...patch };
      // Auto-calc selling from cost + markup unless selling itself was edited.
      if (("costPrice" in patch || "markupPct" in patch) && !("sellingPrice" in patch)) {
        merged.sellingPrice = sellingFromMarkup(merged.costPrice, merged.markupPct);
      }
      return merged;
    }));
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const addOption = () => {
    const nextLabel = (["A", "B", "C"] as const).find((l) => !optionLabels.includes(l));
    if (nextLabel) setOptions((prev) => [...prev, { label: nextLabel, name: `Option ${nextLabel}`, note: "" }]);
  };

  const removeOption = (label: "A" | "B" | "C") => {
    if (options.length <= 1) return;
    setOptions((prev) => prev.filter((o) => o.label !== label));
    setItems((prev) => prev.filter((i) => i.optionLabel !== label));
  };

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(customerId && destination.trim());
    if (step === 1) return items.length > 0;
    return true;
  }, [step, customerId, destination, items.length]);

  const finalize = (statusSend: "draft" | "sent") => {
    if (!customerId || !destination.trim()) { setError("Add a customer and destination first."); setStep(0); return; }
    if (items.length === 0) { setError("Add at least one service."); setStep(1); return; }
    const id = ws.createQuotation({
      quotation: {
        customerId,
        enquiryId: linkedEnquiry?.id,
        destination,
        travelStartDate: startDate,
        travelEndDate: endDate,
        travellers: { adults, children, infants },
        currency,
        validUntil,
        createdById: currentUser.id,
        depositPct,
        exclusions: exclusionsText.split("\n").map((s) => s.trim()).filter(Boolean),
        terms,
        selectedOptionLabel: primaryLabel,
        status: statusSend,
      },
      options: options.map((o) => ({ label: o.label, name: o.name, note: o.note || undefined })),
      items: items.map((i) => ({
        optionLabel: i.optionLabel,
        type: i.type,
        supplier: i.supplier,
        description: i.description,
        startDate: i.startDate || undefined,
        endDate: i.endDate || undefined,
        quantity: i.quantity,
        costPrice: i.costPrice,
        markupPct: i.markupPct,
        sellingPrice: i.sellingPrice,
        taxPct: i.taxPct,
        notes: i.notes || undefined,
        cancellation: i.cancellation || undefined,
      })),
    });
    if (statusSend === "sent") ws.updateQuotationStatus(id, "sent");
    router.push(`/quotations/${id}`);
  };

  const inputCls = "field";

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => (i < step || canNext ? setStep(i) : null)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${i === step ? "border-terracotta bg-terracotta text-white" : i < step ? "border-line bg-surface" : "border-line bg-surface text-muted"}`}
            >
              <span className="tnum">{i < step ? <Check className="size-3.5" /> : i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      {error ? <p className="rounded-lg border-l-2 border-error bg-error/5 px-3 py-2 text-sm text-error">{error}</p> : null}

      {/* Step 1 */}
      {step === 0 ? (
        <div className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer">
              <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Destination">
              <input className={inputCls} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Maasai Mara" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Travel start" optional><input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Travel end" optional><input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Adults"><input type="number" min={1} className={inputCls} value={adults} onChange={(e) => setAdults(+e.target.value)} /></Field>
            <Field label="Children"><input type="number" min={0} className={inputCls} value={children} onChange={(e) => setChildren(+e.target.value)} /></Field>
            <Field label="Infants"><input type="number" min={0} className={inputCls} value={infants} onChange={(e) => setInfants(+e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency">
              <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {(["KES", "USD", "EUR", "GBP"] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Quotation valid until"><input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
            <Field label="Deposit %"><input type="number" min={0} max={100} className={inputCls} value={depositPct} onChange={(e) => setDepositPct(+e.target.value)} /></Field>
          </div>
          {linkedEnquiry ? <p className="text-xs text-muted">Linked to enquiry {linkedEnquiry.ref}.</p> : null}
        </div>
      ) : null}

      {/* Step 2 */}
      {step === 1 ? (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="card p-8 text-center text-sm text-muted">No services yet. Add flights, hotels, transfers, activities and fees.</div>
          ) : null}
          {items.map((it) => (
            <div key={it.key} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <select className="field max-w-[190px]" value={it.type} onChange={(e) => updateItem(it.key, { type: e.target.value as QuotationItemType })} aria-label="Item type">
                  {Object.entries(QUOTATION_ITEM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {options.length > 1 ? (
                  <select className="field max-w-[130px]" value={it.optionLabel} onChange={(e) => updateItem(it.key, { optionLabel: e.target.value as "A" | "B" | "C" })} aria-label="Assign to option">
                    {optionLabels.map((l) => <option key={l} value={l}>Option {l}</option>)}
                  </select>
                ) : null}
                <button type="button" className="ml-auto text-muted hover:text-error" onClick={() => removeItem(it.key)} aria-label="Remove item"><Trash2 className="size-4" /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Supplier / airline" optional><input className="field" value={it.supplier} onChange={(e) => updateItem(it.key, { supplier: e.target.value })} /></Field>
                <Field label="Description"><input className="field" value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="From" optional><input type="date" className="field" value={it.startDate} onChange={(e) => updateItem(it.key, { startDate: e.target.value })} /></Field>
                <Field label="To" optional><input type="date" className="field" value={it.endDate} onChange={(e) => updateItem(it.key, { endDate: e.target.value })} /></Field>
                <Field label="Qty"><input type="number" min={1} className="field" value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: +e.target.value })} /></Field>
                <Field label="Tax %"><input type="number" min={0} className="field" value={it.taxPct} onChange={(e) => updateItem(it.key, { taxPct: +e.target.value })} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={`Cost (${currency})`}><input type="number" min={0} className="field" value={it.costPrice} onChange={(e) => updateItem(it.key, { costPrice: +e.target.value })} /></Field>
                <Field label="Markup %"><input type="number" min={0} className="field" value={it.markupPct} onChange={(e) => updateItem(it.key, { markupPct: +e.target.value })} /></Field>
                <Field label={`Selling (${currency})`}><input type="number" min={0} className="field" value={it.sellingPrice} onChange={(e) => updateItem(it.key, { sellingPrice: +e.target.value })} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Notes" optional><input className="field" value={it.notes} onChange={(e) => updateItem(it.key, { notes: e.target.value })} /></Field>
                <Field label="Cancellation conditions" optional><input className="field" value={it.cancellation} onChange={(e) => updateItem(it.key, { cancellation: e.target.value })} /></Field>
              </div>
              <p className="tnum text-right text-xs text-muted">Line total: {money(it.sellingPrice * it.quantity * (1 + it.taxPct / 100), currency)}</p>
            </div>
          ))}
          <button type="button" className="btn btn-ghost w-full" onClick={addItem}><Plus className="size-4" /> Add service</button>
        </div>
      ) : null}

      {/* Step 3 */}
      {step === 2 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Offer up to three options (e.g. different airlines, camps or package levels). The customer can compare them.</p>
          {options.map((o) => {
            const t = totalsForOption(o.label);
            return (
              <div key={o.label} className="card space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="badge badge-info">Option {o.label}</span>
                  <input className="field" value={o.name} onChange={(e) => setOptions((prev) => prev.map((x) => x.label === o.label ? { ...x, name: e.target.value } : x))} placeholder="Option name" />
                  {options.length > 1 ? <button type="button" className="text-muted hover:text-error" onClick={() => removeOption(o.label)} aria-label="Remove option"><Trash2 className="size-4" /></button> : null}
                </div>
                <input className="field" value={o.note} onChange={(e) => setOptions((prev) => prev.map((x) => x.label === o.label ? { ...x, note: e.target.value } : x))} placeholder="Short comparison note (optional)" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{items.filter((i) => i.optionLabel === o.label).length} service(s)</span>
                  <span className="tnum font-semibold">{money(t.total, currency)}</span>
                </div>
              </div>
            );
          })}
          {options.length < 3 ? <button type="button" className="btn btn-ghost w-full" onClick={addOption}><Plus className="size-4" /> Add option</button> : null}
        </div>
      ) : null}

      {/* Step 4 */}
      {step === 3 ? (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Review</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs text-muted">Customer</p><p className="font-medium">{ws.customer(customerId)?.name}</p></div>
              <div><p className="text-xs text-muted">Destination</p><p className="font-medium">{destination}</p></div>
              <div><p className="text-xs text-muted">Travel dates</p><p>{formatDateRange(startDate, endDate)}</p></div>
              <div><p className="text-xs text-muted">Travellers</p><p>{adults} adults, {children} children, {infants} infants</p></div>
            </div>
          </div>
          {options.map((o) => {
            const list = items.filter((i) => i.optionLabel === o.label);
            const t = totalsForOption(o.label);
            return (
              <div key={o.label} className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold"><span className="badge badge-info mr-2">Option {o.label}</span>{o.name}</h3>
                  <span className="tnum font-bold">{money(t.total, currency)}</span>
                </div>
                <ul className="divide-y divide-line text-sm">
                  {list.map((i) => (
                    <li key={i.key} className="flex justify-between gap-3 py-2">
                      <span>{QUOTATION_ITEM_LABELS[i.type]} — {i.description || "(no description)"}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</span>
                      <span className="tnum text-muted">{money(i.sellingPrice * i.quantity, currency)}</span>
                    </li>
                  ))}
                  {list.length === 0 ? <li className="py-2 text-muted">No services in this option.</li> : null}
                </ul>
                <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                  <div className="flex justify-between"><dt className="text-muted">Deposit ({depositPct}%)</dt><dd className="tnum">{money(depositAmount(t.total, depositPct), currency)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Balance due</dt><dd className="tnum">{money(t.total - depositAmount(t.total, depositPct), currency)}</dd></div>
                </dl>
              </div>
            );
          })}
          <div className="card p-5">
            <Field label="Exclusions (one per line)"><textarea className="field" rows={3} value={exclusionsText} onChange={(e) => setExclusionsText(e.target.value)} /></Field>
            <div className="mt-3"><Field label="Terms"><textarea className="field" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field></div>
            <p className="mt-3 text-xs text-muted">Consultant contact: {currentUser.name} · {currentUser.email}</p>
          </div>
        </div>
      ) : null}

      {/* Step 5 */}
      {step === 4 ? (
        <div className="card space-y-4 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Send quotation</h2>
          <p className="text-sm text-muted">
            Primary option <strong>{primaryLabel}</strong> · Total <strong className="tnum">{money(primaryTotals.total, currency)}</strong>.
            Choose how to save or share this quotation.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn btn-primary hover:btn-primary-hover" onClick={() => finalize("sent")}>Save &amp; mark as sent</button>
            <button className="btn btn-ghost" onClick={() => finalize("draft")}>Save as draft</button>
          </div>
          <div className="rounded-lg border border-line bg-surface-2/50 p-3 text-xs text-muted">
            <p className="font-semibold text-ink">Delivery options (available after saving):</p>
            <p className="mt-1">Generate PDF · Private share link · Send by email · Send by WhatsApp. These appear on the saved quotation page. Sending a quotation does not confirm supplier availability or issue tickets.</p>
          </div>
        </div>
      ) : null}

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary hover:btn-primary-hover" onClick={() => { if (canNext) { setError(null); setStep((s) => s + 1); } else setError(step === 1 ? "Add at least one service." : "Complete the required fields."); }}>
            Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}
