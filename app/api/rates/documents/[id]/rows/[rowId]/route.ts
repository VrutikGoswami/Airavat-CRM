import { rateRowPatchSchema } from "@/lib/rates/validation";
import { rateErrorResponse, requireRateStaff } from "@/lib/rates/server";

type Context = { params: Promise<{ id: string; rowId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { id, rowId } = await context.params;
    const { supabase } = await requireRateStaff();
    const parsed = rateRowPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Check the rate-row values." },
        { status: 422 },
      );
    }
    const { data, error } = await supabase
      .from("hotel_rate_rows")
      .update({ ...parsed.data, validation_errors: [] })
      .eq("id", rowId)
      .eq("document_id", id)
      .eq("active", false)
      .select("*,hotel:rate_hotels(id,slug,name,destination_slug,destination_name,city,country,star_rating)")
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Published rate rows cannot be edited." }, { status: 409 });
    return Response.json({ row: data });
  } catch (error) {
    return rateErrorResponse(error);
  }
}
