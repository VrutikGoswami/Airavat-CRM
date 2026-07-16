import { extractionCallbackSchema } from "@/lib/rates/validation";
import { normalizeExtraction, rateErrorResponse, requireRateService, secretsMatch } from "@/lib/rates/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const expected = process.env.N8N_RATE_CALLBACK_SECRET;
    if (!secretsMatch(authorization, expected ? `Bearer ${expected}` : undefined)) {
      return Response.json({ error: "Invalid callback credentials." }, { status: 401 });
    }

    const parsed = extractionCallbackSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Invalid extraction callback payload." }, { status: 422 });
    }

    const service = requireRateService();
    if (parsed.data.status === "error") {
      const { error } = await service
        .from("rate_documents")
        .update({
          status: "error",
          extraction_model: parsed.data.model ?? null,
          error_message: parsed.data.errorMessage,
        })
        .eq("id", parsed.data.documentId)
        .neq("status", "approved");
      if (error) throw error;
      return Response.json({ ok: true });
    }

    const normalized = normalizeExtraction(parsed.data);
    const { error } = await service.rpc("replace_rate_extraction", {
      p_document_id: parsed.data.documentId,
      p_document: normalized.document,
      p_hotels: normalized.hotels,
      p_rows: normalized.rows,
      p_warnings: normalized.warnings,
      p_model: parsed.data.model,
      p_payload: parsed.data.extraction,
    });
    if (error) throw error;
    return Response.json({ ok: true, validRows: normalized.rows.length });
  } catch (error) {
    return rateErrorResponse(error);
  }
}
