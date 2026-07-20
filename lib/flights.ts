import type { Currency } from "@/lib/types";

export type FlightCabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
export type FlightFareSource = "live" | "test" | "demo";

export type FlightSearchInput = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: FlightCabin;
  currency: Currency;
  directOnly: boolean;
};

export type FlightLeg = {
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  durationMinutes: number;
  stops: number;
  flightNumbers: string[];
};

export type FlightOffer = {
  id: string;
  source: FlightFareSource;
  airline: string;
  airlineCode: string;
  agentCost: number;
  baseFare: number;
  taxes: number;
  currency: Currency;
  cabin: FlightCabin;
  baggage: string;
  seatsRemaining?: number;
  lastTicketingDate?: string;
  fareType: string;
  legs: FlightLeg[];
};

export type RankedFlightOffer = {
  label: "A" | "B" | "C";
  title: string;
  offer: FlightOffer;
};

export type FlightSearchResponse = {
  offers: FlightOffer[];
  source: FlightFareSource;
  message?: string;
  searchedAt: string;
};

export const CABIN_LABELS: Record<FlightCabin, string> = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "Premium economy",
  BUSINESS: "Business",
  FIRST: "First",
};

export function totalDuration(offer: FlightOffer): number {
  return offer.legs.reduce((total, leg) => total + leg.durationMinutes, 0);
}

export function totalStops(offer: FlightOffer): number {
  return offer.legs.reduce((total, leg) => total + leg.stops, 0);
}

export function rankFlightOffers(offers: FlightOffer[]): RankedFlightOffer[] {
  if (offers.length === 0) return [];

  const cheapestCost = Math.min(...offers.map((offer) => offer.agentCost));
  const fastestTime = Math.max(1, Math.min(...offers.map(totalDuration)));
  const selected = new Set<string>();
  const ranked: RankedFlightOffer[] = [];

  const add = (label: "A" | "B" | "C", title: string, offer?: FlightOffer) => {
    if (!offer || selected.has(offer.id)) return;
    selected.add(offer.id);
    ranked.push({ label, title, offer });
  };

  const recommended = [...offers].sort((a, b) => {
    const scoreA = a.agentCost / cheapestCost + totalDuration(a) / fastestTime + totalStops(a) * 0.35;
    const scoreB = b.agentCost / cheapestCost + totalDuration(b) / fastestTime + totalStops(b) * 0.35;
    return scoreA - scoreB;
  })[0];
  add("A", "Recommended", recommended);
  const cheapest = [...offers].sort((a, b) => a.agentCost - b.agentCost);
  add("B", selected.has(cheapest[0]?.id) ? "Value alternative" : "Lowest fare", cheapest.find((offer) => !selected.has(offer.id)));
  const fastest = [...offers].sort((a, b) => totalDuration(a) - totalDuration(b));
  add("C", selected.has(fastest[0]?.id) ? "Faster alternative" : "Shortest journey", fastest.find((offer) => !selected.has(offer.id)));

  for (const offer of offers) {
    if (ranked.length >= 3) break;
    const label = (["A", "B", "C"] as const)[ranked.length];
    add(label, label === "B" ? "Alternative fare" : "Alternative schedule", offer);
  }

  return ranked;
}

export function formatFlightDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins ? ` ${mins}m` : ""}`;
}
