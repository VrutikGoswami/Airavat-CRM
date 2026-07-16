import assert from "node:assert/strict";
import { normalizeExtraction } from "../lib/rates/normalize";
import type { CompletedExtractionCallback } from "../lib/rates/validation";

const commonRate = {
  rate_type: "Accommodation",
  season_name: "Low season",
  booking_by: null,
  blackout_dates: [],
  room_type: "Deluxe Room",
  meal_plan: "Full Board",
  occupancy: "Double",
  adults: 2,
  children: 0,
  currency: "KES",
  market: "East African Residents",
  rate_basis: "Per Room Per Night",
  minimum_stay: null,
  tax_included: "Yes" as const,
  commission_included: "Unknown" as const,
  conditions: "",
  source_page: 2,
  confidence: "High" as const,
};

const callback: CompletedExtractionCallback = {
  documentId: "51000000-0000-4000-8000-000000000001",
  status: "completed",
  model: "gemini-test",
  extraction: {
    document: {
      document_type: "Rate Sheet",
      is_rate_sheet: true,
      supplier_name: "Test Supplier",
      contract_name: "2026 Resident Rates",
      pricing_basis: "net",
      default_market: "East African Residents",
      default_currency: "KES",
      issued_date: null,
      overall_valid_from: null,
      overall_valid_to: null,
      summary: "Two date bands for one room.",
      confidence: "High",
    },
    hotels: [
      {
        hotel_name: "Test Lodge",
        destination: "Amboseli",
        city: "",
        country: "Kenya",
        star_rating: null,
        child_policy: "",
        cancellation_policy: "",
        payment_terms: "",
        tax_notes: "",
        rates: [
          { ...commonRate, valid_from: "2026-01-01", valid_to: "2026-03-31", amount: 10_000 },
          { ...commonRate, season_name: "High season", valid_from: "2026-04-01", valid_to: "2026-06-30", amount: 14_000 },
          { ...commonRate, valid_from: null, valid_to: null, amount: 9_000 },
        ],
      },
    ],
    warnings: [],
  },
};

const normalized = normalizeExtraction(callback);
assert.equal(normalized.document.pricing_basis, "unknown");
assert.equal(normalized.rows.length, 2, "Different valid date ranges must remain separate rows.");
assert.notEqual(normalized.rows[0].extraction_key, normalized.rows[1].extraction_key);
assert.deepEqual(
  normalized.rows.map((row) => [row.valid_from, row.valid_to, row.amount]),
  [
    ["2026-01-01", "2026-03-31", 10_000],
    ["2026-04-01", "2026-06-30", 14_000],
  ],
);
assert.equal(normalized.document.invalid_rate_rows, 1);
assert.match(normalized.warnings[0], /administrator must confirm/i);

console.log("CRM rate tests passed: date bands, semantic rejection, and human pricing confirmation.");
