import { rateErrorResponse, requireRateStaff } from "@/lib/rates/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { supabase, staff } = await requireRateStaff();
    const { data: document, error: documentError } = await supabase
      .from("rate_documents")
      .select("id,status,pricing_basis")
      .eq("id", id)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return Response.json({ error: "Rate document not found." }, { status: 404 });
    if (document.status !== "review") {
      return Response.json({ error: "Only reviewed documents can be published." }, { status: 409 });
    }
    if (document.pricing_basis === "unknown") {
      return Response.json({ error: "Choose rack or net pricing before publishing." }, { status: 409 });
    }

    const { data: rows, error: rowsError } = await supabase
      .from("hotel_rate_rows")
      .select("id,review_status,validation_errors")
      .eq("document_id", id);
    if (rowsError) throw rowsError;

    const publishableIds = (rows ?? [])
      .filter((row) => row.review_status !== "rejected" && (row.validation_errors?.length ?? 0) === 0)
      .map((row) => row.id);
    if (publishableIds.length === 0) {
      return Response.json({ error: "The document has no valid rate rows to publish." }, { status: 409 });
    }

    const { error: publishError } = await supabase.rpc("publish_rate_document_service", {
      p_document_id: id,
      p_actor_id: staff.id,
    });
    if (publishError) throw publishError;

    return Response.json({ ok: true });
  } catch (error) {
    return rateErrorResponse(error);
  }
}
