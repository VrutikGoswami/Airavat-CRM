import { z } from "zod";
import { rateErrorResponse, requireRateStaff } from "@/lib/rates/server";
import { isSupabaseMode } from "@/lib/supabase";

export const runtime = "nodejs";

const metadataSchema = z.object({
  area: z.string().trim().max(120).nullable(),
  shortDescription: z.string().trim().max(600).nullable(),
  imageUrls: z.array(z.string().trim().min(1).max(500)).max(8),
  amenities: z.array(z.string().trim().min(1).max(80)).max(20),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = metadataSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Check the hotel details." }, { status: 422 });
    }

    if (!isSupabaseMode()) {
      return Response.json({
        hotel: { id, ...parsed.data },
        notice: "Sample hotel details updated for this session only.",
      });
    }

    const { supabase } = await requireRateStaff();
    const { data, error } = await supabase
      .from("rate_hotels")
      .update({
        area: parsed.data.area || null,
        short_description: parsed.data.shortDescription || null,
        image_urls: parsed.data.imageUrls,
        amenities: parsed.data.amenities,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id,area,short_description,image_urls,amenities")
      .single();
    if (error) throw error;
    return Response.json({ hotel: data, notice: "Hotel details saved." });
  } catch (error) {
    const databaseError = error as { code?: string; message?: string };
    if (databaseError.code === "42703") {
      return Response.json(
        { error: "Hotel metadata is not ready. Apply Supabase migration 0005, then save again." },
        { status: 503 },
      );
    }
    return rateErrorResponse(error);
  }
}
