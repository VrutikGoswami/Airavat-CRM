import { RATE_DOCUMENT_BUCKET, rateErrorResponse, requireRateService, requireRateStaff } from "@/lib/rates/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await requireRateStaff();
    const service = requireRateService();
    const { data: document, error } = await service
      .from("rate_documents")
      .select("file_name,storage_path")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!document) return Response.json({ error: "Rate document not found." }, { status: 404 });
    const { data, error: signedError } = await service.storage
      .from(RATE_DOCUMENT_BUCKET)
      .createSignedUrl(document.storage_path, 60, { download: document.file_name });
    if (signedError || !data?.signedUrl) throw signedError || new Error("Could not sign PDF URL.");
    return Response.redirect(data.signedUrl, 302);
  } catch (error) {
    return rateErrorResponse(error);
  }
}
