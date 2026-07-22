"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, RefreshCw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { RateDocumentRecord, RateDocumentStatus } from "@/lib/rates/types";

type ListDocument = Pick<
  RateDocumentRecord,
  | "id"
  | "file_name"
  | "source_relative_path"
  | "ingestion_batch"
  | "supplier_name"
  | "contract_name"
  | "pricing_basis"
  | "status"
  | "hotel_count"
  | "valid_rate_rows"
  | "invalid_rate_rows"
  | "error_message"
  | "uploaded_at"
  | "updated_at"
>;

const processingStatuses = new Set<RateDocumentStatus>(["uploaded", "queued", "extracting"]);

function statusTone(status: RateDocumentStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "approved") return "success";
  if (status === "review") return "warning";
  if (status === "error" || status === "rejected") return "danger";
  if (processingStatuses.has(status)) return "info";
  return "neutral";
}

function readableStatus(status: RateDocumentStatus): string {
  return status === "review" ? "Needs review" : status[0].toUpperCase() + status.slice(1);
}

export function RateDocumentsClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<ListDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/rates/documents", { cache: "no-store" });
      const body = (await response.json()) as { documents?: ListDocument[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load supplier rates.");
      setDocuments(body.documents ?? []);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load supplier rates.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!documents.some((document) => processingStatuses.has(document.status))) return;
    const interval = window.setInterval(() => void load(true), 8_000);
    return () => window.clearInterval(interval);
  }, [documents, load]);

  async function uploadRatePdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = [...(inputRef.current?.files ?? [])];
    if (files.length === 0) {
      setError("Choose one or more supplier PDFs first.");
      return;
    }
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const uploaded: ListDocument[] = [];
      const failures: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/rates/documents", { method: "POST", body: form });
        const body = (await response.json()) as {
          document?: ListDocument;
          error?: string;
          warning?: string;
        };
        if (body.document) uploaded.push(body.document);
        if (!response.ok || body.warning) {
          failures.push(`${file.name}: ${body.error || body.warning || "upload failed"}`);
        }
      }
      if (uploaded.length > 0) setDocuments((current) => [...uploaded.reverse(), ...current]);
      if (inputRef.current) inputRef.current.value = "";
      setNotice(`${uploaded.length} of ${files.length} PDFs uploaded. Extraction starts separately for each document.`);
      if (failures.length > 0) setError(failures.join(" "));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The PDF could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  const awaitingReview = documents.filter((document) => document.status === "review").length;
  const processing = documents.filter((document) => processingStatuses.has(document.status)).length;
  const published = documents.filter((document) => document.status === "approved").length;

  return (
    <div className="space-y-6">
      <section className="border-y border-line bg-surface px-4 py-5 sm:px-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr] lg:items-end">
          <div>
            <h2 className="text-base font-bold">Upload supplier rate PDFs</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              The PDF stays private. AI extraction creates inactive rows that must be reviewed
              before they can appear on the website.
            </p>
          </div>
          <form onSubmit={uploadRatePdf} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="field-label">Supplier PDF</span>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                required
                className="input file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              <Upload className="size-4" aria-hidden />
              {uploading ? "Uploading batch..." : "Upload and extract"}
            </button>
          </form>
        </div>
      </section>

      {notice ? <p className="border-l-2 border-success bg-success/10 px-4 py-3 text-sm">{notice}</p> : null}
      {error ? <p className="border-l-2 border-error bg-error/10 px-4 py-3 text-sm text-error">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Processing" value={processing} />
        <Metric label="Needs review" value={awaitingReview} />
        <Metric label="Published" value={published} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Rate documents</h2>
          <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden /> Refresh
          </button>
        </div>

        {loading && documents.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Loading supplier rates...</p>
        ) : documents.length === 0 ? (
          <div className="border border-dashed border-line px-5 py-12 text-center">
            <FileText className="mx-auto size-8 text-muted" aria-hidden />
            <p className="mt-3 font-semibold">No supplier PDFs uploaded yet</p>
            <p className="mt-1 text-sm text-muted">The first upload will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {documents.map((document) => (
              <article key={document.id} className="grid gap-4 bg-surface px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">{document.file_name}</h3>
                    <Badge tone={statusTone(document.status)}>{readableStatus(document.status)}</Badge>
                    {document.pricing_basis !== "unknown" ? (
                      <Badge tone="neutral">{document.pricing_basis.toUpperCase()}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {[document.supplier_name, document.contract_name].filter(Boolean).join(" · ") || "Supplier details pending extraction"}
                  </p>
                  {document.source_relative_path ? (
                    <p className="mt-1 truncate text-xs text-muted">{document.source_relative_path}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">
                    {document.hotel_count} hotels · {document.valid_rate_rows} valid rows · {document.invalid_rate_rows} excluded · uploaded {new Date(document.uploaded_at).toLocaleString()}
                  </p>
                  {document.error_message ? (
                    <p className="mt-2 text-xs font-semibold text-error">{document.error_message}</p>
                  ) : null}
                </div>
                <Link href={`/rates/${document.id}`} className="btn btn-secondary w-full sm:w-auto">
                  {document.status === "review" ? "Review rates" : "Open"}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-l-2 border-terracotta bg-surface px-4 py-3">
      <p className="tnum text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
