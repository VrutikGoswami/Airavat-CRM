import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { getServerSupabase } from "@/lib/supabase-server";
import { getServiceSupabase, isSupabaseMode } from "@/lib/supabase";

export { normalizeExtraction } from "@/lib/rates/normalize";

export const RATE_DOCUMENT_BUCKET = "supplier-rate-documents";
export const MAX_RATE_PDF_BYTES = 18 * 1024 * 1024;

export class RatePipelineError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function requireRateStaff() {
  if (!isSupabaseMode()) {
    throw new RatePipelineError("Supplier rate management requires Supabase data mode.", 503);
  }

  const supabase = await getServerSupabase();
  if (!supabase) throw new RatePipelineError("Supabase is not configured.", 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new RatePipelineError("Sign in to manage supplier rates.", 401);

  const { data: staff, error } = await supabase
    .from("users")
    .select("id,name,email,role,active")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (error || !staff) throw new RatePipelineError("Active staff access is required.", 403);

  return {
    supabase,
    staff: {
      id: String(staff.id),
      name: String(staff.name || staff.email || "Staff"),
      email: String(staff.email || user.email || ""),
      role: staff.role === "admin" ? ("admin" as const) : ("consultant" as const),
    },
  };
}

export function requireRateService() {
  const service = getServiceSupabase();
  if (!service) throw new RatePipelineError("Supabase service access is not configured.", 503);
  return service;
}

export function rateErrorResponse(error: unknown): Response {
  if (error instanceof RatePipelineError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "The supplier-rate operation could not be completed." }, { status: 500 });
}

export function pdfSignatureIsValid(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.subarray(0, Math.min(bytes.length, 1024)))
    .toString("latin1")
    .includes("%PDF-");
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function secretsMatch(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function safeFileName(fileName: string): string {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "supplier-rates"}.pdf`;
}

export function newDocumentStoragePath(fileName: string): { id: string; path: string } {
  const id = randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  return { id, path: `${day}/${id}/${safeFileName(fileName)}` };
}

export async function dispatchRateExtraction({
  documentId,
  fileName,
  storagePath,
  callbackOrigin,
}: {
  documentId: string;
  fileName: string;
  storagePath: string;
  callbackOrigin: string;
}) {
  const webhookUrl = process.env.N8N_RATE_EXTRACTION_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_RATE_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    throw new RatePipelineError("The n8n rate-extraction webhook is not configured.", 503);
  }

  const service = requireRateService();
  const { data, error } = await service.storage
    .from(RATE_DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, 15 * 60, { download: fileName });
  if (error || !data?.signedUrl) {
    throw new RatePipelineError(error?.message || "Could not create a PDF download URL.", 500);
  }

  const publicOrigin = process.env.CRM_PUBLIC_URL?.replace(/\/$/, "") || callbackOrigin;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${webhookSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      documentId,
      fileName,
      downloadUrl: data.signedUrl,
      callbackUrl: `${publicOrigin}/api/rates/extraction-callback`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new RatePipelineError(
      `n8n rejected the extraction request (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      502,
    );
  }
}
