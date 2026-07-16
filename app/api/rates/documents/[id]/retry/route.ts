import { dispatchRateExtraction, rateErrorResponse, requireRateService, requireRateStaff } from "@/lib/rates/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await requireRateStaff();
    const service = requireRateService();
    const { data: document, error } = await service
      .from("rate_documents")
      .select("id,file_name,storage_path,status")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!document) return Response.json({ error: "Rate document not found." }, { status: 404 });
    if (document.status === "approved") {
      return Response.json({ error: "Approved documents cannot be re-extracted." }, { status: 409 });
    }

    try {
      await dispatchRateExtraction({
        documentId: document.id,
        fileName: document.file_name,
        storagePath: document.storage_path,
        callbackOrigin: new URL(request.url).origin,
      });
      const { data } = await service
        .from("rate_documents")
        .update({
          status: "extracting",
          extraction_started_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", id)
        .select("*")
        .single();
      return Response.json({ document: data });
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "Could not start n8n.";
      await service.from("rate_documents").update({ status: "error", error_message: message }).eq("id", id);
      throw dispatchError;
    }
  } catch (error) {
    return rateErrorResponse(error);
  }
}
