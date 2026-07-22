import type { HotelSearchResult } from "@/lib/hotels";

export type CustomerHotelSelection = {
  rooms: number;
  hotel: string;
  roomType: string;
  occupancy: string;
  mealPlan: string;
  currency: string;
  total: number | null;
  perNight: number | null;
  explicit: boolean;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amount(value: string, suffix: string): { currency: string; amount: number | null } {
  const match = value.match(new RegExp(`\\b(KES|USD|EUR|GBP)\\s+([\\d,.]+)\\s+${suffix}\\b`, "i"));
  return {
    currency: match?.[1]?.toUpperCase() ?? "",
    amount: match?.[2] ? Number(match[2].replaceAll(",", "")) : null,
  };
}

export function parseCustomerHotelSelection(requirements: string): CustomerHotelSelection {
  let rooms = 1;
  let roomConfiguration = "";
  let mealPlan = "";
  let notes = requirements;

  try {
    const payload = JSON.parse(requirements) as {
      notes?: unknown;
      service_details?: { rooms?: unknown; roomConfiguration?: unknown; mealPlan?: unknown };
    };
    const details = payload.service_details ?? {};
    const parsedRooms = Number(details.rooms);
    rooms = Number.isInteger(parsedRooms) && parsedRooms > 0 ? parsedRooms : 1;
    roomConfiguration = text(details.roomConfiguration);
    mealPlan = text(details.mealPlan);
    notes = text(payload.notes);
  } catch {
    // Older enquiries may contain the same selected-rate summary as plain text.
  }

  const configuration = roomConfiguration.split(/\s*·\s*/).map((part) => part.trim());
  const noteParts = notes.split(/\s*·\s*/).map((part) => part.trim());
  const markerIndex = noteParts.findIndex((part) => /selected website hotel rate/i.test(part));
  const selectedParts = markerIndex >= 0 ? noteParts.slice(markerIndex + 1) : [];
  const total = amount(notes, "total");
  const nightly = amount(notes, "per night");

  return {
    rooms,
    hotel: configuration[0] || selectedParts[0] || "",
    roomType: configuration[1] || selectedParts[1] || "",
    occupancy: configuration[2] || selectedParts[2] || "",
    mealPlan: mealPlan || selectedParts[3] || "",
    currency: total.currency || nightly.currency,
    total: total.amount,
    perNight: nightly.amount,
    explicit: markerIndex >= 0 || total.amount !== null || nightly.amount !== null || configuration.length >= 3,
  };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagScore(expected: string, actual: string, exact: number, partial: number): number {
  const wanted = normalize(expected);
  const candidate = normalize(actual);
  if (!wanted || !candidate) return 0;
  if (wanted === candidate) return exact;
  return wanted.includes(candidate) || candidate.includes(wanted) ? partial : 0;
}

function priceDistance(expected: number | null, candidates: Array<number | null>): number {
  if (expected === null || expected <= 0) return Number.POSITIVE_INFINITY;
  return Math.min(
    ...candidates
      .filter((value): value is number => value !== null && value > 0)
      .map((value) => Math.abs(value - expected) / expected),
  );
}

export function resolveCustomerSelectedRate(
  results: HotelSearchResult[],
  selection: CustomerHotelSelection,
  nights: number,
): string | null {
  if (!selection.explicit || !selection.hotel) return null;

  const candidates = results.flatMap((result) =>
    result.rates.map((rate) => {
      const hotelScore = tagScore(selection.hotel, result.hotel.name, 100, 65);
      const roomScore = tagScore(selection.roomType, rate.roomType, 70, 45);
      const occupancyScore = tagScore(selection.occupancy, rate.occupancy, 35, 20);
      const mealScore = tagScore(selection.mealPlan, rate.mealPlan, 30, 18);
      const currencyScore = selection.currency && selection.currency === rate.currency ? 8 : 0;
      const roomNights = Math.max(1, selection.rooms) * Math.max(1, nights);
      const totalDistance = priceDistance(selection.total, [rate.clientTotal, rate.netTotal]);
      const nightlyDistance = priceDistance(selection.perNight, [
        rate.amount,
        rate.clientTotal === null ? null : rate.clientTotal / roomNights,
        rate.netTotal === null ? null : rate.netTotal / roomNights,
      ]);
      const closestPrice = Math.min(totalDistance, nightlyDistance);
      const priceScore = closestPrice <= 0.02 ? 40 : closestPrice <= 0.2 ? 24 : closestPrice <= 0.5 ? 8 : 0;

      return {
        id: rate.id,
        hotelScore,
        roomScore,
        score: hotelScore + roomScore + occupancyScore + mealScore + currencyScore + priceScore,
        priceDistance: closestPrice,
      };
    }),
  );

  const ranked = candidates
    .filter((candidate) => candidate.hotelScore > 0 && candidate.roomScore > 0 && candidate.score >= 110)
    .sort((a, b) =>
      b.score - a.score
      || a.priceDistance - b.priceDistance
      || a.id.localeCompare(b.id),
    );

  return ranked[0]?.id ?? null;
}
