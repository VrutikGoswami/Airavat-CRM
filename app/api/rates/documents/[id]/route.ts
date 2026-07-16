import { rateDocumentPatchSchema } from "@/lib/rates/validation";
import { rateErrorResponse, requireRateStaff } from "@/lib/rates/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { supabase } = await requireRateStaff();
    const [{ data: document, error: documentError }, { data: rows, error: rowsError }] =
      await Promise.all([
        supabase.from("rate_documents").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("hotel_rate_rows")
          .select("*,hotel:rate_hotels(id,slug,name,destination_slug,destination_name,city,country,star_rating)")
          .eq("document_id", id)
          .order("valid_from")
          .order("room_type"),
      ]);
    if (documentError) throw documentError;
    if (rowsError) throw rowsError;
    if (!document) return Response.json({ error: "Rate document not found." }, { status: 404 });
    return Response.json({ document: { ...document, rows: rows ?? [] } });
  } catch (error) {
    return rateErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { supabase } = await requireRateStaff();
    const parsed = rateDocumentPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Choose a valid pricing basis." }, { status: 422 });
    }
    const { data, error } = await supabase
      .from("rate_documents")
      .update(parsed.data)
      .eq("id", id)
      .eq("status", "review")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Only reviewed documents can be edited." }, { status: 409 });
    return Response.json({ document: data });
  } catch (error) {
    return rateErrorResponse(error);
  }
}
