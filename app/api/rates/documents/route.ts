import { dispatchRateExtraction, MAX_RATE_PDF_BYTES, newDocumentStoragePath, pdfSignatureIsValid, RATE_DOCUMENT_BUCKET, rateErrorResponse, requireRateService, requireRateStaff, sha256 } from "@/lib/rates/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { supabase } = await requireRateStaff();
    const { data, error } = await supabase
      .from("rate_documents")
      .select("id,file_name,source_relative_path,ingestion_batch,supplier_name,contract_name,pricing_basis,status,hotel_count,valid_rate_rows,invalid_rate_rows,error_message,uploaded_at,updated_at")
      .order("uploaded_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return Response.json({ documents: data ?? [] });
  } catch (error) {
    return rateErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { staff } = await requireRateStaff();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose a supplier PDF to upload." }, { status: 422 });
    }
    if (file.size <= 0 || file.size > MAX_RATE_PDF_BYTES) {
      return Response.json({ error: "The PDF must be between 1 byte and 18 MiB." }, { status: 422 });
    }
    if (file.type && file.type !== "application/pdf") {
      return Response.json({ error: "Only PDF supplier rate files are accepted." }, { status: 422 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!pdfSignatureIsValid(bytes)) {
      return Response.json({ error: "The uploaded file is not a valid PDF." }, { status: 422 });
    }

    const service = requireRateService();
    const contentHash = sha256(bytes);
    const { data: duplicate } = await service
      .from("rate_documents")
      .select("id,file_name,status,uploaded_at")
      .eq("content_sha256", contentHash)
      .maybeSingle();
    if (duplicate) {
      return Response.json(
        { error: "This exact supplier PDF has already been uploaded.", duplicate },
        { status: 409 },
      );
    }

    const storage = newDocumentStoragePath(file.name);
    const { error: uploadError } = await service.storage
      .from(RATE_DOCUMENT_BUCKET)
      .upload(storage.path, bytes, {
        contentType: "application/pdf",
        cacheControl: "private, max-age=0",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: document, error: insertError } = await service
      .from("rate_documents")
      .insert({
        id: storage.id,
        file_name: file.name,
        storage_bucket: RATE_DOCUMENT_BUCKET,
        storage_path: storage.path,
        mime_type: "application/pdf",
        file_size_bytes: file.size,
        content_sha256: contentHash,
        status: "queued",
        uploaded_by: staff.id,
      })
      .select("*")
      .single();
    if (insertError || !document) {
      await service.storage.from(RATE_DOCUMENT_BUCKET).remove([storage.path]);
      throw insertError || new Error("Could not create the rate document record.");
    }

    try {
      await dispatchRateExtraction({
        documentId: document.id,
        fileName: document.file_name,
        storagePath: document.storage_path,
        callbackOrigin: new URL(request.url).origin,
      });
      const { data: extracting } = await service
        .from("rate_documents")
        .update({
          status: "extracting",
          extraction_started_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", document.id)
        .select("*")
        .single();
      return Response.json({ document: extracting ?? document }, { status: 201 });
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "Could not start n8n.";
      const { data: failed } = await service
        .from("rate_documents")
        .update({ status: "error", error_message: message })
        .eq("id", document.id)
        .select("*")
        .single();
      return Response.json(
        { document: failed ?? document, warning: message },
        { status: 202 },
      );
    }
  } catch (error) {
    return rateErrorResponse(error);
  }
}
