import { z } from "zod";
import {
  HOTEL_MARKUP_PERCENT,
  calculateHotelRate,
  cancellationIsFree,
  hotelNights,
  lastStayDate,
  marketMatches,
  occupancyFits,
  stayHitsBlackout,
  type HotelRateOffer,
  type HotelMetadata,
  type HotelSearchInput,
  type HotelSearchResult,
} from "@/lib/hotels";
import { createDemoHotelSearch } from "@/lib/hotels/demo";
import { rateErrorResponse, requireRateStaff } from "@/lib/rates/server";
import { isSupabaseMode } from "@/lib/supabase";

export const runtime = "nodejs";

const searchSchema = z.object({
  destination: z.string().trim().min(2).max(120),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  rooms: z.number().int().min(1).max(10),
  adults: z.number().int().min(1).max(40),
  children: z.number().int().min(0).max(40),
  market: z.string().trim().max(80).default("Any"),
  mealPlan: z.string().trim().max(80).default("Any"),
  budget: z.number().positive().nullable().optional(),
}).superRefine((value, context) => {
  if (hotelNights(value.checkIn, value.checkOut) < 1) {
    context.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in." });
  }
  if (value.rooms > value.adults + value.children) {
    context.addIssue({ code: "custom", path: ["rooms"], message: "Each room needs at least one traveller." });
  }
});

type JoinedHotel = {
  id: string;
  name: string;
  destination_name: string;
  city: string | null;
  country: string | null;
  star_rating: number | null;
  area: string | null;
  short_description: string | null;
  image_urls: string[] | null;
  amenities: string[] | null;
  hotel_group: string | null;
  website_url: string | null;
};

type JoinedDocument = { supplier_name: string | null; pricing_basis: "rack" | "net" };

type JoinedRate = {
  id: string;
  document_id: string;
  hotel_id: string;
  rate_type: string;
  valid_from: string;
  valid_to: string;
  booking_by: string | null;
  blackout_dates: string[] | null;
  room_type: string;
  meal_plan: string;
  occupancy: string;
  adults: number | null;
  children: number | null;
  amount: number | string;
  currency: string;
  market: string;
  unit_basis: string;
  minimum_stay: number | null;
  tax_included: "Yes" | "No" | "Unknown";
  commission_included: "Yes" | "No" | "Unknown";
  cancellation_policy: string | null;
  payment_terms: string | null;
  conditions: string | null;
  hotel: JoinedHotel | JoinedHotel[];
  document: JoinedDocument | JoinedDocument[];
};

function joinedOne<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

function destinationMatches(hotel: JoinedHotel, destination: string): boolean {
  const requested = destination.toLowerCase();
  const haystack = [hotel.name, hotel.destination_name, hotel.city, hotel.country, hotel.area]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tokens = requested.split(/\s+/).filter((token) => token.length > 1);
  return haystack.includes(requested) || tokens.every((token) => haystack.includes(token));
}

function hotelMetadata(hotel: JoinedHotel): HotelMetadata {
  return {
    id: hotel.id,
    name: hotel.name,
    destinationName: hotel.destination_name,
    city: hotel.city,
    country: hotel.country,
    starRating: hotel.star_rating,
    area: hotel.area,
    shortDescription: hotel.short_description,
    imageUrls: hotel.image_urls ?? [],
    amenities: hotel.amenities ?? [],
    hotelGroup: hotel.hotel_group,
    websiteUrl: hotel.website_url,
  };
}

export async function POST(request: Request) {
  try {
    const parsed = searchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Check the hotel search details." }, { status: 422 });
    }
    const input: HotelSearchInput = parsed.data;
    if (!isSupabaseMode()) return Response.json(createDemoHotelSearch(input));

    const nights = hotelNights(input.checkIn, input.checkOut);
    const { supabase } = await requireRateStaff();
    const { data, error } = await supabase
      .from("hotel_rate_rows")
      .select(`
        id,document_id,hotel_id,rate_type,valid_from,valid_to,booking_by,blackout_dates,
        room_type,meal_plan,occupancy,adults,children,amount,currency,market,unit_basis,
        minimum_stay,tax_included,commission_included,cancellation_policy,payment_terms,conditions,
        hotel:rate_hotels!inner(id,name,destination_name,city,country,star_rating,area,short_description,image_urls,amenities,hotel_group,website_url),
        document:rate_documents!inner(supplier_name,status,pricing_basis)
      `)
      .eq("active", true)
      .eq("review_status", "approved")
      .eq("hotel.active", true)
      .eq("document.status", "approved")
      .lte("valid_from", input.checkIn)
      .gte("valid_to", lastStayDate(input.checkIn, input.checkOut))
      .limit(1500);
    if (error) throw error;
    const { data: mediaData, error: mediaError } = await supabase
      .from("rate_hotels")
      .select("id,name,destination_name,city,country,star_rating,area,short_description,image_urls,amenities,hotel_group,website_url")
      .eq("active", true);
    if (mediaError) throw mediaError;

    const grouped = new Map<string, HotelSearchResult>();
    for (const row of (data ?? []) as unknown as JoinedRate[]) {
      const hotel = joinedOne(row.hotel);
      const document = joinedOne(row.document);
      if (!hotel || !document || !destinationMatches(hotel, input.destination)) continue;
      if (!marketMatches(row.market, input.market)) continue;
      if (input.mealPlan !== "Any" && row.meal_plan.toLowerCase() !== input.mealPlan.toLowerCase()) continue;
      if (row.booking_by && row.booking_by < new Date().toISOString().slice(0, 10)) continue;
      if (row.minimum_stay && nights < row.minimum_stay) continue;
      if (stayHitsBlackout(row.blackout_dates ?? [], input.checkIn, input.checkOut)) continue;
      if (!occupancyFits({ rateAdults: row.adults, rateChildren: row.children, ...input })) continue;

      const totals = calculateHotelRate({
        amount: Number(row.amount),
        unitBasis: row.unit_basis,
        nights,
        rooms: input.rooms,
        adults: input.adults,
        children: input.children,
        markupPercent: HOTEL_MARKUP_PERCENT,
      });
      const offer: HotelRateOffer = {
        id: row.id,
        hotelId: row.hotel_id,
        documentId: row.document_id,
        supplierName: document.supplier_name || hotel.name,
        pricingBasis: document.pricing_basis,
        roomType: row.room_type,
        mealPlan: row.meal_plan,
        occupancy: row.occupancy,
        rateType: row.rate_type,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        bookingBy: row.booking_by,
        amount: Number(row.amount),
        currency: row.currency,
        market: row.market,
        unitBasis: row.unit_basis,
        minimumStay: row.minimum_stay,
        taxIncluded: row.tax_included,
        commissionIncluded: row.commission_included,
        cancellationPolicy: row.cancellation_policy,
        paymentTerms: row.payment_terms,
        conditions: row.conditions,
        ...totals,
        freeCancellation: cancellationIsFree(row.cancellation_policy),
      };

      const existing = grouped.get(hotel.id);
      if (existing) {
        existing.rates.push(offer);
      } else {
        grouped.set(hotel.id, {
          hotel: hotelMetadata(hotel),
          rates: [offer],
        });
      }
    }

    for (const hotel of (mediaData ?? []) as JoinedHotel[]) {
      if (grouped.has(hotel.id)) continue;
      if (!(hotel.image_urls?.length ?? 0) || !destinationMatches(hotel, input.destination)) continue;
      grouped.set(hotel.id, { hotel: hotelMetadata(hotel), rates: [] });
    }

    return Response.json({
      source: "live",
      notice: "Approved rates are shown where available; other properties are marked rate on request.",
      nights,
      results: [...grouped.values()],
    });
  } catch (error) {
    const databaseError = error as { code?: string; message?: string };
    if (databaseError.code === "PGRST205" || databaseError.message?.includes("hotel_rate_rows")) {
      return Response.json(
        { error: "Supplier hotel rates are not ready. Apply Supabase migrations 0004 and 0005, then search again." },
        { status: 503 },
      );
    }
    return rateErrorResponse(error);
  }
}
