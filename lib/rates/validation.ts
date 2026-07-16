import { z } from "zod";

const nullableText = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableInteger = z.number().int().nullable().optional();

const extractedRateSchema = z.object({
  rate_type: z.string(),
  season_name: z.string().default(""),
  valid_from: nullableText,
  valid_to: nullableText,
  booking_by: nullableText,
  blackout_dates: z.array(z.string()).default([]),
  room_type: z.string().default(""),
  meal_plan: z.string().default("Not Stated"),
  occupancy: z.string().default("Not Stated"),
  adults: nullableInteger,
  children: nullableInteger,
  amount: nullableNumber,
  currency: z.string().default(""),
  market: z.string().default(""),
  rate_basis: z.string().default("Other"),
  minimum_stay: nullableInteger,
  tax_included: z.enum(["Yes", "No", "Unknown"]).default("Unknown"),
  commission_included: z.enum(["Yes", "No", "Unknown"]).default("Unknown"),
  conditions: z.string().default(""),
  source_page: nullableInteger,
  confidence: z.enum(["High", "Medium", "Low"]).default("Low"),
});

const extractedHotelSchema = z.object({
  hotel_name: z.string(),
  destination: z.string(),
  city: z.string().default(""),
  country: z.string().default(""),
  star_rating: nullableNumber,
  child_policy: z.string().default(""),
  cancellation_policy: z.string().default(""),
  payment_terms: z.string().default(""),
  tax_notes: z.string().default(""),
  rates: z.array(extractedRateSchema).default([]),
});

export const completedExtractionCallbackSchema = z.object({
  documentId: z.string().uuid(),
  status: z.literal("completed"),
  model: z.string().min(1).max(120),
  extraction: z.object({
    document: z.object({
      document_type: z.string().default("Other"),
      is_rate_sheet: z.boolean().default(true),
      supplier_name: z.string().default(""),
      contract_name: z.string().default(""),
      pricing_basis: z.enum(["unknown", "rack", "net"]).default("unknown"),
      default_market: z.string().default(""),
      default_currency: z.string().default(""),
      issued_date: nullableText,
      overall_valid_from: nullableText,
      overall_valid_to: nullableText,
      summary: z.string().default(""),
      confidence: z.enum(["High", "Medium", "Low"]).default("Low"),
    }),
    hotels: z.array(extractedHotelSchema),
    warnings: z.array(z.string()).default([]),
  }),
});

export const failedExtractionCallbackSchema = z.object({
  documentId: z.string().uuid(),
  status: z.literal("error"),
  model: z.string().max(120).optional(),
  errorMessage: z.string().min(1).max(4000),
});

export const extractionCallbackSchema = z.discriminatedUnion("status", [
  completedExtractionCallbackSchema,
  failedExtractionCallbackSchema,
]);

export const rateDocumentPatchSchema = z.object({
  pricing_basis: z.enum(["unknown", "rack", "net"]),
});

export const rateRowPatchSchema = z
  .object({
    rate_type: z.string().trim().min(1).max(80).optional(),
    season_name: z.string().trim().max(120).nullable().optional(),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    room_type: z.string().trim().min(1).max(180).optional(),
    meal_plan: z.string().trim().min(1).max(80).optional(),
    occupancy: z.string().trim().min(1).max(120).optional(),
    adults: z.number().int().min(0).nullable().optional(),
    children: z.number().int().min(0).nullable().optional(),
    amount: z.number().positive().max(100000000).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    market: z.string().trim().min(1).max(120).optional(),
    unit_basis: z.string().trim().min(1).max(120).optional(),
    minimum_stay: z.number().int().positive().nullable().optional(),
    review_status: z.enum(["pending", "approved", "rejected"]).optional(),
  })
  .refine((value) => !value.valid_from || !value.valid_to || value.valid_to >= value.valid_from, {
    message: "Valid-to date must not be before valid-from date.",
    path: ["valid_to"],
  });

export type CompletedExtractionCallback = z.infer<typeof completedExtractionCallbackSchema>;
