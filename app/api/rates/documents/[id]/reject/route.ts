import { rateErrorResponse, requireRateStaff } from "@/lib/rates/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { supabase, staff } = await requireRateStaff();
    if (staff.role !== "admin") {
      return Response.json({ error: "Administrator access is required to reject a document." }, { status: 403 });
    }
    const { error } = await supabase.rpc("reject_rate_document", { p_document_id: id });
    if (error) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) {
    return rateErrorResponse(error);
  }
}
