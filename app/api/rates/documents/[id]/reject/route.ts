import { rateErrorResponse, requireRateStaff } from "@/lib/rates/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { supabase, staff } = await requireRateStaff();
    const { error: rowsError } = await supabase
      .from("hotel_rate_rows")
      .update({ review_status: "rejected", active: false })
      .eq("document_id", id);
    if (rowsError) throw rowsError;

    const { data, error } = await supabase
      .from("rate_documents")
      .update({
        status: "rejected",
        reviewed_by: staff.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .neq("status", "approved")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Document cannot be rejected." }, { status: 409 });

    return Response.json({ ok: true });
  } catch (error) {
    return rateErrorResponse(error);
  }
}
