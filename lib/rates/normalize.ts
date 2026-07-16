import { createHash } from "node:crypto";
import type { CompletedExtractionCallback } from "@/lib/rates/validation";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "unnamed-hotel";
}

function validIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeExtraction(callback: CompletedExtractionCallback) {
  const extraction = callback.extraction;
  const document = extraction.document;
  const hotels = new Map<string, Record<string, unknown>>();
  const rows: Record<string, unknown>[] = [];
  const warnings = [...extraction.warnings];
  if (document.pricing_basis !== "unknown") {
    warnings.unshift(
      `Gemini suggested ${document.pricing_basis} pricing. An administrator must confirm the pricing basis before publishing.`,
    );
  }
  const seen = new Set<string>();
  let invalidRateRows = 0;

  for (const hotel of extraction.hotels) {
    const hotelName = hotel.hotel_name.trim();
    const destinationName = hotel.destination.trim();
    if (!hotelName || !destinationName) {
      invalidRateRows += hotel.rates.length;
      warnings.push("A hotel was excluded because its name or destination was missing.");
      continue;
    }

    const hotelSlug = slugify(`${hotelName}-${destinationName}`);
    hotels.set(hotelSlug, {
      slug: hotelSlug,
      name: hotelName,
      destination_slug: slugify(destinationName),
      destination_name: destinationName,
      city: hotel.city.trim(),
      country: hotel.country.trim(),
      star_rating: hotel.star_rating ?? null,
    });

    for (let index = 0; index < hotel.rates.length; index += 1) {
      const rate = hotel.rates[index];
      const validFrom = validIsoDate(rate.valid_from)
        ? rate.valid_from
        : validIsoDate(document.overall_valid_from)
          ? document.overall_valid_from
          : null;
      const validTo = validIsoDate(rate.valid_to)
        ? rate.valid_to
        : validIsoDate(document.overall_valid_to)
          ? document.overall_valid_to
          : null;
      const amount = Number(rate.amount);
      const currency = String(rate.currency || document.default_currency || "").trim().toUpperCase();
      const roomType = rate.room_type.trim();
      const market = String(rate.market || document.default_market || "Not Stated").trim();
      const errors: string[] = [];

      if (!validFrom || !validTo || validTo < validFrom) errors.push("valid date range is missing");
      if (!Number.isFinite(amount) || amount <= 0) errors.push("positive amount is missing");
      if (!/^[A-Z]{3}$/.test(currency)) errors.push("three-letter currency is missing");
      if (!roomType) errors.push("room type is missing");
      if (!rate.occupancy.trim()) errors.push("occupancy is missing");

      if (errors.length) {
        invalidRateRows += 1;
        warnings.push(`${hotelName} rate ${index + 1}: ${errors.join(", ")}.`);
        continue;
      }

      const signature = [
        hotelSlug,
        rate.rate_type,
        rate.season_name,
        validFrom,
        validTo,
        roomType,
        rate.meal_plan,
        rate.occupancy,
        rate.adults ?? "",
        rate.children ?? "",
        amount.toFixed(2),
        currency,
        market,
        rate.rate_basis,
      ]
        .map((value) => String(value).trim().toLowerCase())
        .join("|");
      if (seen.has(signature)) {
        invalidRateRows += 1;
        warnings.push(`${hotelName} rate ${index + 1}: duplicate row removed.`);
        continue;
      }
      seen.add(signature);

      rows.push({
        hotel_slug: hotelSlug,
        extraction_key: createHash("sha256").update(signature).digest("hex"),
        rate_type: rate.rate_type,
        season_name: rate.season_name,
        valid_from: validFrom,
        valid_to: validTo,
        booking_by: validIsoDate(rate.booking_by) ? rate.booking_by : null,
        blackout_dates: rate.blackout_dates.map((value) => value.trim()).filter(Boolean),
        room_type: roomType,
        meal_plan: rate.meal_plan.trim() || "Not Stated",
        occupancy: rate.occupancy.trim(),
        adults: rate.adults ?? null,
        children: rate.children ?? null,
        amount,
        currency,
        market,
        unit_basis: rate.rate_basis,
        minimum_stay: rate.minimum_stay ?? null,
        tax_included: rate.tax_included,
        commission_included: rate.commission_included,
        child_policy: hotel.child_policy,
        cancellation_policy: hotel.cancellation_policy,
        payment_terms: hotel.payment_terms,
        conditions: [rate.conditions, hotel.tax_notes].filter(Boolean).join(" | "),
        source_page: rate.source_page ?? null,
        ai_confidence: rate.confidence,
        validation_errors: [],
      });
    }
  }

  return {
    document: {
      supplier_name: document.supplier_name,
      contract_name: document.contract_name,
      document_type: document.document_type,
      pricing_basis: "unknown",
      default_market: document.default_market,
      default_currency: document.default_currency,
      summary: document.summary,
      confidence: document.confidence,
      invalid_rate_rows: invalidRateRows,
    },
    hotels: [...hotels.values()],
    rows,
    warnings: warnings.slice(0, 200),
  };
}
