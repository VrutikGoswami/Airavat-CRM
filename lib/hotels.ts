export const HOTEL_MARKUP_PERCENT = 2;

export type HotelSearchInput = {
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  market: string;
  mealPlan: string;
  budget?: number | null;
};

export type HotelMetadata = {
  id: string;
  name: string;
  destinationName: string;
  city: string | null;
  country: string | null;
  starRating: number | null;
  area: string | null;
  shortDescription: string | null;
  imageUrls: string[];
  amenities: string[];
  hotelGroup: string | null;
  websiteUrl: string | null;
};

export type HotelRateOffer = {
  id: string;
  hotelId: string;
  documentId: string;
  supplierName: string;
  pricingBasis: "rack" | "net";
  roomType: string;
  mealPlan: string;
  occupancy: string;
  rateType: string;
  validFrom: string;
  validTo: string;
  bookingBy: string | null;
  amount: number;
  currency: string;
  market: string;
  unitBasis: string;
  minimumStay: number | null;
  taxIncluded: "Yes" | "No" | "Unknown";
  commissionIncluded: "Yes" | "No" | "Unknown";
  cancellationPolicy: string | null;
  paymentTerms: string | null;
  conditions: string | null;
  netTotal: number | null;
  clientTotal: number | null;
  calculationNote: string;
  requiresConfirmation: boolean;
  freeCancellation: boolean;
};

export type HotelSearchResult = {
  hotel: HotelMetadata;
  rates: HotelRateOffer[];
};

export type HotelSearchResponse = {
  source: "live" | "demo";
  notice: string;
  nights: number;
  results: HotelSearchResult[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDay(value: string): number {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function hotelNights(checkIn: string, checkOut: string): number {
  const start = parseIsoDay(checkIn);
  const end = parseIsoDay(checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

export function lastStayDate(checkIn: string, checkOut: string): string {
  const nights = hotelNights(checkIn, checkOut);
  if (nights < 1) return checkIn;
  return new Date(parseIsoDay(checkOut) - DAY_MS).toISOString().slice(0, 10);
}

export function stayDates(checkIn: string, checkOut: string): string[] {
  const nights = hotelNights(checkIn, checkOut);
  if (nights < 1) return [];
  const start = parseIsoDay(checkIn);
  return Array.from({ length: nights }, (_, index) =>
    new Date(start + index * DAY_MS).toISOString().slice(0, 10));
}

function normalizeBasis(value: string): string {
  return value.trim().toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ");
}

export function calculateHotelRate({
  amount,
  unitBasis,
  nights,
  rooms,
  adults: _adults,
  children: _children,
  markupPercent = HOTEL_MARKUP_PERCENT,
}: {
  amount: number;
  unitBasis: string;
  nights: number;
  rooms: number;
  adults: number;
  children: number;
  markupPercent?: number;
}): Pick<HotelRateOffer, "netTotal" | "clientTotal" | "calculationNote" | "requiresConfirmation"> {
  const basis = normalizeBasis(unitBasis);
  let multiplier: number | null = null;
  let calculationNote = "";
  void _adults;
  void _children;

  if (basis === "per room per night") {
    multiplier = rooms * nights;
    calculationNote = `${rooms} room${rooms === 1 ? "" : "s"} x ${nights} night${nights === 1 ? "" : "s"}`;
  } else if (basis === "per person per night" || basis === "per person sharing per night") {
    multiplier = rooms * nights;
    calculationNote = `${rooms} room${rooms === 1 ? "" : "s"} x ${nights} night${nights === 1 ? "" : "s"}; occupancy rate applied once per room`;
  } else if (basis === "per person per stay") {
    multiplier = rooms;
    calculationNote = `${rooms} room${rooms === 1 ? "" : "s"} per stay; occupancy rate applied once per room`;
  } else if (basis === "per room per stay") {
    multiplier = rooms;
    calculationNote = `${rooms} room${rooms === 1 ? "" : "s"} per stay`;
  } else if (basis === "package total" || basis === "flat amount") {
    multiplier = 1;
    calculationNote = "Package total";
  }

  if (multiplier === null || !Number.isFinite(amount) || amount < 0) {
    return {
      netTotal: null,
      clientTotal: null,
      calculationNote: `Confirm ${unitBasis || "rate basis"} with the supplier`,
      requiresConfirmation: true,
    };
  }

  const netTotal = Math.round(amount * multiplier * 100) / 100;
  const clientTotal = Math.round(netTotal * (1 + markupPercent / 100) * 100) / 100;
  return { netTotal, clientTotal, calculationNote, requiresConfirmation: false };
}

export function cancellationIsFree(policy: string | null): boolean {
  if (!policy) return false;
  const normalized = policy.toLowerCase();
  return normalized.includes("free cancellation") || normalized.includes("no charge") || normalized.includes("fully refundable");
}

function rangeIncludesDate(range: string, date: string): boolean {
  const dates = range.match(/\d{4}-\d{2}-\d{2}/g);
  if (!dates?.length) return false;
  if (dates.length === 1) return dates[0] === date;
  return date >= dates[0] && date <= dates[1];
}

export function stayHitsBlackout(blackouts: string[], checkIn: string, checkOut: string): boolean {
  const dates = stayDates(checkIn, checkOut);
  return blackouts.some((blackout) => dates.some((date) => rangeIncludesDate(blackout, date)));
}

export function occupancyFits({
  rateAdults,
  rateChildren,
  rooms,
  adults,
  children,
}: {
  rateAdults: number | null;
  rateChildren: number | null;
  rooms: number;
  adults: number;
  children: number;
}): boolean {
  const adultsPerRoom = Math.ceil(adults / rooms);
  const childrenPerRoom = Math.ceil(children / rooms);
  return (rateAdults === null || adultsPerRoom <= rateAdults)
    && (rateChildren === null || childrenPerRoom <= rateChildren);
}

export function marketMatches(rateMarket: string, requestedMarket: string): boolean {
  const requested = requestedMarket.trim().toLowerCase();
  const rate = rateMarket.trim().toLowerCase();
  if (!requested || requested === "any" || !rate || rate === "all" || rate === "any") return true;
  return rate.includes(requested) || requested.includes(rate);
}
