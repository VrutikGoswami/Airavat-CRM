export type RateDocumentStatus =
  | "uploaded"
  | "queued"
  | "extracting"
  | "review"
  | "approved"
  | "rejected"
  | "error";

export type RatePricingBasis = "unknown" | "rack" | "net";
export type RateReviewStatus = "pending" | "approved" | "rejected";

export type RateDocumentRecord = {
  id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  content_sha256: string;
  supplier_name: string | null;
  contract_name: string | null;
  document_type: string | null;
  pricing_basis: RatePricingBasis;
  default_market: string | null;
  default_currency: string | null;
  status: RateDocumentStatus;
  extraction_model: string | null;
  hotel_count: number;
  valid_rate_rows: number;
  invalid_rate_rows: number;
  warnings: string[];
  summary: string | null;
  ai_confidence: string | null;
  error_message: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  extraction_started_at: string | null;
  extracted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  updated_at: string;
};

export type RateHotelRecord = {
  id: string;
  slug: string;
  name: string;
  destination_slug: string;
  destination_name: string;
  city: string | null;
  country: string | null;
  star_rating: number | null;
  area: string | null;
  short_description: string | null;
  image_urls: string[];
  amenities: string[];
};

export type HotelRateRowRecord = {
  id: string;
  document_id: string;
  hotel_id: string;
  extraction_key: string;
  rate_type: string;
  season_name: string | null;
  valid_from: string;
  valid_to: string;
  booking_by: string | null;
  blackout_dates: string[];
  room_type: string;
  meal_plan: string;
  occupancy: string;
  adults: number | null;
  children: number | null;
  amount: number;
  currency: string;
  market: string;
  unit_basis: string;
  minimum_stay: number | null;
  tax_included: "Yes" | "No" | "Unknown";
  commission_included: "Yes" | "No" | "Unknown";
  child_policy: string | null;
  cancellation_policy: string | null;
  payment_terms: string | null;
  conditions: string | null;
  source_page: number | null;
  ai_confidence: "High" | "Medium" | "Low";
  validation_errors: string[];
  review_status: RateReviewStatus;
  active: boolean;
  hotel?: RateHotelRecord;
};

export type RateDocumentDetail = RateDocumentRecord & {
  rows: HotelRateRowRecord[];
};
