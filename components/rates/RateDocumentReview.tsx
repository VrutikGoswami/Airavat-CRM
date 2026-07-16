"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Download, RefreshCw, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useWorkspace } from "@/lib/workspace";
import type { HotelRateRowRecord, RateDocumentDetail } from "@/lib/rates/types";

const unitBasisOptions = [
  "Per Room Per Night",
  "Per Person Per Night",
  "Per Person Sharing Per Night",
  "Per Child Per Night",
  "Per Person Per Stay",
  "Per Room Per Stay",
  "Package Total",
  "Flat Amount",
  "Other",
];

export function RateDocumentReview({ documentId }: { documentId: string }) {
  const { currentUser } = useWorkspace();
  const [document, setDocument] = useState<RateDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rates/documents/${documentId}`, { cache: "no-store" });
      const body = (await response.json()) as { document?: RateDocumentDetail; error?: string };
      if (!response.ok || !body.document) throw new Error(body.error || "Could not load this document.");
      setDocument(body.document);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this document.");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updatePricingBasis(pricingBasis: "unknown" | "rack" | "net") {
    setBusy("basis");
    setError(null);
    try {
      const response = await fetch(`/api/rates/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing_basis: pricingBasis }),
      });
      const body = (await response.json()) as { document?: RateDocumentDetail; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not update pricing basis.");
      setDocument((current) => current ? { ...current, pricing_basis: pricingBasis } : current);
      setNotice("Pricing basis saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update pricing basis.");
    } finally {
      setBusy(null);
    }
  }

  async function documentAction(action: "retry" | "publish" | "reject") {
    if (action === "publish" && !window.confirm("Publish all accepted rows to the website?")) return;
    if (action === "reject" && !window.confirm("Reject this entire supplier document?")) return;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/rates/documents/${documentId}/${action}`, { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || `Could not ${action} this document.`);
      setNotice(action === "publish" ? "Rates published to the website." : action === "reject" ? "Document rejected." : "Extraction restarted.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${action} this document.`);
    } finally {
      setBusy(null);
    }
  }

  async function saveRow(rowId: string, patch: Partial<HotelRateRowRecord>) {
    setBusy(rowId);
    setError(null);
    try {
      const response = await fetch(`/api/rates/documents/${documentId}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await response.json()) as { row?: HotelRateRowRecord; error?: string };
      if (!response.ok || !body.row) throw new Error(body.error || "Could not save the rate row.");
      setDocument((current) => current ? { ...current, rows: current.rows.map((row) => row.id === rowId ? body.row! : row) } : current);
      setNotice("Rate row saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the rate row.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !document) return <p className="py-12 text-center text-sm text-muted">Loading extracted rates...</p>;
  if (!document) {
    return (
      <div>
        <Link href="/rates" className="btn btn-secondary"><ArrowLeft className="size-4" /> Supplier rates</Link>
        <p className="mt-6 border-l-2 border-error bg-error/10 px-4 py-3 text-sm text-error">{error || "Rate document not found."}</p>
      </div>
    );
  }

  const acceptedRows = document.rows.filter((row) => row.review_status !== "rejected").length;
  const canEdit = document.status === "review";
  const canPublish = canEdit && document.pricing_basis !== "unknown" && acceptedRows > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/rates" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> Supplier rates
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{document.file_name}</h1>
          <p className="mt-1 text-sm text-muted">{[document.supplier_name, document.contract_name].filter(Boolean).join(" · ") || "Supplier details not extracted"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={document.status === "approved" ? "success" : document.status === "review" ? "warning" : document.status === "error" ? "danger" : "info"}>
            {document.status === "review" ? "Needs review" : document.status}
          </Badge>
          <a href={`/api/rates/documents/${documentId}/download`} className="btn btn-secondary">
            <Download className="size-4" aria-hidden /> Source PDF
          </a>
        </div>
      </div>

      {notice ? <p className="border-l-2 border-success bg-success/10 px-4 py-3 text-sm">{notice}</p> : null}
      {error ? <p className="border-l-2 border-error bg-error/10 px-4 py-3 text-sm text-error">{error}</p> : null}
      {document.error_message ? <p className="border-l-2 border-error bg-error/10 px-4 py-3 text-sm text-error">{document.error_message}</p> : null}

      <section className="border-y border-line bg-surface px-4 py-5 sm:px-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Hotels" value={String(document.hotel_count)} />
            <Fact label="Extracted rows" value={String(document.valid_rate_rows)} />
            <Fact label="Excluded rows" value={String(document.invalid_rate_rows)} />
            <label>
              <span className="field-label">Supplier prices are</span>
              <select
                className="input"
                value={document.pricing_basis}
                disabled={!canEdit || busy === "basis"}
                onChange={(event) => void updatePricingBasis(event.target.value as "unknown" | "rack" | "net")}
              >
                <option value="unknown">Choose before publishing</option>
                <option value="rack">Rack / public selling rates</option>
                <option value="net">Net / confidential cost rates</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {(document.status === "error" || document.status === "rejected") ? (
              <button className="btn btn-secondary" onClick={() => void documentAction("retry")} disabled={busy !== null}>
                <RefreshCw className="size-4" aria-hidden /> Retry extraction
              </button>
            ) : null}
            {currentUser.role === "admin" && canEdit ? (
              <>
                <button className="btn btn-secondary text-error" onClick={() => void documentAction("reject")} disabled={busy !== null}>
                  <X className="size-4" aria-hidden /> Reject document
                </button>
                <button className="btn btn-primary" onClick={() => void documentAction("publish")} disabled={busy !== null || !canPublish}>
                  <Check className="size-4" aria-hidden /> Publish {acceptedRows} rows
                </button>
              </>
            ) : null}
          </div>
        </div>
        {document.summary ? <p className="mt-4 max-w-4xl text-sm leading-relaxed text-muted">{document.summary}</p> : null}
        {document.pricing_basis === "unknown" && canEdit ? (
          <p className="mt-3 text-xs font-semibold text-warning">Confirm whether these are rack or net rates before publishing.</p>
        ) : null}
      </section>

      {document.warnings.length > 0 ? (
        <details className="border-y border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">Extraction warnings ({document.warnings.length})</summary>
          <ul className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
            {document.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
          </ul>
        </details>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Extracted hotel rates</h2>
            <p className="mt-1 text-xs text-muted">Every date range remains a separate row. Reject unusable rows before publishing.</p>
          </div>
          <p className="text-xs font-semibold text-muted">{acceptedRows} accepted · {document.rows.length - acceptedRows} rejected</p>
        </div>
        {document.rows.length === 0 ? (
          <p className="border border-dashed border-line px-4 py-10 text-center text-sm text-muted">No valid rate rows were extracted. Review the warnings or retry extraction.</p>
        ) : (
          <div className="space-y-2">
            {document.rows.map((row) => (
              <RateRowEditor key={row.id} row={row} editable={canEdit} saving={busy === row.id} onSave={(patch) => saveRow(row.id, patch)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RateRowEditor({
  row,
  editable,
  saving,
  onSave,
}: {
  row: HotelRateRowRecord;
  editable: boolean;
  saving: boolean;
  onSave: (patch: Partial<HotelRateRowRecord>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(row);

  useEffect(() => setDraft(row), [row]);

  const field = <K extends keyof HotelRateRowRecord>(key: K, value: HotelRateRowRecord[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      rate_type: draft.rate_type,
      season_name: draft.season_name,
      valid_from: draft.valid_from,
      valid_to: draft.valid_to,
      room_type: draft.room_type,
      meal_plan: draft.meal_plan,
      occupancy: draft.occupancy,
      adults: draft.adults,
      children: draft.children,
      amount: Number(draft.amount),
      currency: draft.currency.toUpperCase(),
      market: draft.market,
      unit_basis: draft.unit_basis,
      minimum_stay: draft.minimum_stay,
      review_status: draft.review_status,
    });
  }

  return (
    <details className={`border bg-surface ${row.review_status === "rejected" ? "border-error/30 opacity-70" : "border-line"}`}>
      <summary className="grid cursor-pointer list-none gap-2 px-3 py-3 text-sm sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto] sm:items-center sm:px-4">
        <span className="font-semibold">{row.hotel?.name || "Unknown hotel"} · {row.room_type}</span>
        <span className="text-muted">{row.valid_from} to {row.valid_to}</span>
        <span className="text-muted">{row.occupancy} · {row.meal_plan}</span>
        <span className="tnum font-semibold">{row.currency} {Number(row.amount).toLocaleString()}</span>
        <Badge tone={row.review_status === "rejected" ? "danger" : "neutral"}>{row.review_status}</Badge>
      </summary>
      <form onSubmit={submit} className="grid gap-4 border-t border-line px-3 py-4 sm:grid-cols-2 sm:px-4 lg:grid-cols-4">
        <Input label="Hotel" value={row.hotel?.name || ""} disabled />
        <Input label="Destination" value={row.hotel?.destination_name || ""} disabled />
        <Input label="Room type" value={draft.room_type} disabled={!editable} onChange={(value) => field("room_type", value)} />
        <Input label="Occupancy" value={draft.occupancy} disabled={!editable} onChange={(value) => field("occupancy", value)} />
        <Input label="Valid from" type="date" value={draft.valid_from} disabled={!editable} onChange={(value) => field("valid_from", value)} />
        <Input label="Valid to" type="date" value={draft.valid_to} disabled={!editable} onChange={(value) => field("valid_to", value)} />
        <Input label="Season" value={draft.season_name || ""} disabled={!editable} onChange={(value) => field("season_name", value)} />
        <Input label="Meal plan" value={draft.meal_plan} disabled={!editable} onChange={(value) => field("meal_plan", value)} />
        <Input label="Amount" type="number" value={String(draft.amount)} disabled={!editable} onChange={(value) => field("amount", Number(value))} />
        <Input label="Currency" value={draft.currency} disabled={!editable} onChange={(value) => field("currency", value.toUpperCase())} />
        <Input label="Market" value={draft.market} disabled={!editable} onChange={(value) => field("market", value)} />
        <label>
          <span className="field-label">Rate unit</span>
          <select className="input" value={draft.unit_basis} disabled={!editable} onChange={(event) => field("unit_basis", event.target.value)}>
            {unitBasisOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <Input label="Adults" type="number" value={draft.adults == null ? "" : String(draft.adults)} disabled={!editable} onChange={(value) => field("adults", value === "" ? null : Number(value))} />
        <Input label="Children" type="number" value={draft.children == null ? "" : String(draft.children)} disabled={!editable} onChange={(value) => field("children", value === "" ? null : Number(value))} />
        <Input label="Minimum stay" type="number" value={draft.minimum_stay == null ? "" : String(draft.minimum_stay)} disabled={!editable} onChange={(value) => field("minimum_stay", value === "" ? null : Number(value))} />
        <label>
          <span className="field-label">Review decision</span>
          <select className="input" value={draft.review_status} disabled={!editable} onChange={(event) => field("review_status", event.target.value as HotelRateRowRecord["review_status"])}>
            <option value="pending">Accept on publish</option>
            <option value="rejected">Reject row</option>
          </select>
        </label>
        {editable ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save className="size-4" aria-hidden /> {saving ? "Saving..." : "Save row"}
            </button>
          </div>
        ) : null}
      </form>
    </details>
  );
}

function Input({
  label,
  value,
  type = "text",
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  type?: "text" | "date" | "number";
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input className="input" type={type} value={value} disabled={disabled} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="tnum mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
