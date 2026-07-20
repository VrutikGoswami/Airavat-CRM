import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  FlightCabin,
  FlightFareSource,
  FlightLeg,
  FlightOffer,
  FlightSearchInput,
  FlightSearchResponse,
} from "@/lib/flights";
import type { Currency } from "@/lib/types";

export const runtime = "nodejs";

const searchSchema = z.object({
  origin: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  destination: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  departureDate: z.string().date(),
  returnDate: z.string().date().optional().or(z.literal("")),
  adults: z.number().int().min(1).max(9),
  children: z.number().int().min(0).max(8),
  infants: z.number().int().min(0).max(8),
  cabin: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]),
  currency: z.enum(["KES", "USD", "EUR", "GBP"]),
  directOnly: z.boolean(),
}).refine((value) => value.origin !== value.destination, {
  message: "Origin and destination must be different.",
}).refine((value) => !value.returnDate || value.returnDate >= value.departureDate, {
  message: "Return date must be after departure.",
}).refine((value) => value.infants <= value.adults, {
  message: "Each infant must travel with an adult.",
});

type AmadeusSegment = {
  departure?: { iataCode?: string; at?: string };
  arrival?: { iataCode?: string; at?: string };
  carrierCode?: string;
  number?: string;
};

type AmadeusOffer = {
  id?: string;
  lastTicketingDate?: string;
  numberOfBookableSeats?: number;
  itineraries?: Array<{ duration?: string; segments?: AmadeusSegment[] }>;
  price?: { currency?: string; total?: string; base?: string; grandTotal?: string };
  pricingOptions?: { fareType?: string[] };
  travelerPricings?: Array<{
    fareDetailsBySegment?: Array<{
      cabin?: string;
      includedCheckedBags?: { quantity?: number; weight?: number; weightUnit?: string };
    }>;
  }>;
};

type AmadeusResponse = {
  data?: AmadeusOffer[];
  dictionaries?: { carriers?: Record<string, string> };
  errors?: Array<{ detail?: string; title?: string }>;
};

let tokenCache: { token: string; expiresAt: number; baseUrl: string } | null = null;

function parseDuration(value = ""): number {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : 0;
}

function baggageLabel(offer: AmadeusOffer): string {
  const bag = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags;
  if (!bag) return "Check with airline";
  if (bag.quantity != null) return `${bag.quantity} checked bag${bag.quantity === 1 ? "" : "s"}`;
  if (bag.weight != null) return `${bag.weight}${bag.weightUnit ?? "KG"} checked baggage`;
  return "Check with airline";
}

function normalizeAmadeusOffer(
  offer: AmadeusOffer,
  index: number,
  input: FlightSearchInput,
  source: FlightFareSource,
  carriers: Record<string, string>,
): FlightOffer | null {
  const firstSegment = offer.itineraries?.[0]?.segments?.[0];
  const carrierCode = firstSegment?.carrierCode ?? "";
  const agentCost = Number(offer.price?.grandTotal ?? offer.price?.total ?? 0);
  if (!agentCost || !offer.itineraries?.length) return null;

  const legs: FlightLeg[] = offer.itineraries.map((itinerary) => {
    const segments = itinerary.segments ?? [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    return {
      origin: first?.departure?.iataCode ?? input.origin,
      destination: last?.arrival?.iataCode ?? input.destination,
      departure: first?.departure?.at ?? "",
      arrival: last?.arrival?.at ?? "",
      durationMinutes: parseDuration(itinerary.duration),
      stops: Math.max(0, segments.length - 1),
      flightNumbers: segments.map((segment) => `${segment.carrierCode ?? ""}${segment.number ?? ""}`).filter(Boolean),
    };
  });
  const baseFare = Number(offer.price?.base ?? agentCost);
  const cabin = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin as FlightCabin | undefined;

  return {
    id: offer.id ?? `amadeus-${index}`,
    source,
    airline: carriers[carrierCode] ?? (carrierCode || "Multiple airlines"),
    airlineCode: carrierCode,
    agentCost,
    baseFare,
    taxes: Math.max(0, agentCost - baseFare),
    currency: (offer.price?.currency ?? input.currency) as Currency,
    cabin: cabin ?? input.cabin,
    baggage: baggageLabel(offer),
    seatsRemaining: offer.numberOfBookableSeats,
    lastTicketingDate: offer.lastTicketingDate,
    fareType: offer.pricingOptions?.fareType?.join(", ") || "Published fare",
    legs,
  };
}

async function getAmadeusToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && tokenCache.baseUrl === baseUrl && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description || "Could not connect to Amadeus.");
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 1_800) * 1_000,
    baseUrl,
  };
  return body.access_token;
}

async function searchAmadeus(input: FlightSearchInput): Promise<FlightSearchResponse> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return demoSearch(input);

  const isProduction = process.env.AMADEUS_ENV === "production";
  const baseUrl = isProduction ? "https://api.amadeus.com" : "https://test.api.amadeus.com";
  const source: FlightFareSource = isProduction ? "live" : "test";
  const token = await getAmadeusToken(baseUrl, clientId, clientSecret);
  const query = new URLSearchParams({
    originLocationCode: input.origin,
    destinationLocationCode: input.destination,
    departureDate: input.departureDate,
    adults: String(input.adults),
    travelClass: input.cabin,
    currencyCode: input.currency,
    nonStop: String(input.directOnly),
    max: "20",
  });
  if (input.returnDate) query.set("returnDate", input.returnDate);
  if (input.children) query.set("children", String(input.children));
  if (input.infants) query.set("infants", String(input.infants));

  const response = await fetch(`${baseUrl}/v2/shopping/flight-offers?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const body = await response.json() as AmadeusResponse;
  if (!response.ok) throw new Error(body.errors?.[0]?.detail || body.errors?.[0]?.title || "Flight search failed.");

  const carriers = body.dictionaries?.carriers ?? {};
  const offers = (body.data ?? [])
    .map((offer, index) => normalizeAmadeusOffer(offer, index, input, source, carriers))
    .filter((offer): offer is FlightOffer => Boolean(offer));
  return {
    offers,
    source,
    message: source === "test" ? "Amadeus test fares are for workflow testing and are not bookable." : undefined,
    searchedAt: new Date().toISOString(),
  };
}

const carrierSets = [
  { code: "KQ", name: "Kenya Airways", flight: "KQ310" },
  { code: "ET", name: "Ethiopian Airlines", flight: "ET319" },
  { code: "EK", name: "Emirates", flight: "EK720" },
];

function demoSearch(input: FlightSearchInput): FlightSearchResponse {
  const routeKey = `${input.origin}-${input.destination}`;
  const routeRates: Record<string, number> = {
    "NBO-DXB": 88_000,
    "NBO-LHR": 142_000,
    "NBO-JNB": 76_000,
    "NBO-ZNZ": 49_000,
    "NBO-MBA": 24_000,
  };
  const cabinMultiplier: Record<FlightCabin, number> = {
    ECONOMY: 1,
    PREMIUM_ECONOMY: 1.55,
    BUSINESS: 2.8,
    FIRST: 5,
  };
  const passengerFactor = input.adults + input.children * 0.75 + input.infants * 0.12;
  const tripFactor = input.returnDate ? 1 : 0.58;
  const totalKes = (routeRates[routeKey] ?? 96_000) * cabinMultiplier[input.cabin] * passengerFactor * tripFactor;
  const kesPerCurrency: Record<Currency, number> = { KES: 1, USD: 130, EUR: 150, GBP: 175 };
  const factors = [1.03, 0.94, 1.12];
  const durations = [300, 430, 270];
  const stops = input.directOnly ? [0, 0, 0] : [0, 1, 0];
  const departHours = [8, 18, 22];
  const returnHours = [15, 9, 11];

  const offers = carrierSets.map((carrier, index): FlightOffer => {
    const agentCost = Math.round(totalKes * factors[index] / kesPerCurrency[input.currency]);
    const makeLeg = (from: string, to: string, date: string, hour: number, duration: number, flight: string): FlightLeg => {
      const departure = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
      const arrival = new Date(departure.getTime() + duration * 60_000);
      return {
        origin: from,
        destination: to,
        departure: departure.toISOString(),
        arrival: arrival.toISOString(),
        durationMinutes: duration,
        stops: stops[index],
        flightNumbers: stops[index] ? [flight, `${carrier.code}${Number(flight.replace(/\D/g, "")) + 4}`] : [flight],
      };
    };
    const legs = [makeLeg(input.origin, input.destination, input.departureDate, departHours[index], durations[index], carrier.flight)];
    if (input.returnDate) legs.push(makeLeg(input.destination, input.origin, input.returnDate, returnHours[index], durations[index] + 10, carrier.flight));
    const ticketing = new Date(`${input.departureDate}T00:00:00Z`);
    ticketing.setUTCDate(ticketing.getUTCDate() - 3);
    return {
      id: `demo-${routeKey}-${index}`,
      source: "demo",
      airline: carrier.name,
      airlineCode: carrier.code,
      agentCost,
      baseFare: Math.round(agentCost * 0.72),
      taxes: Math.round(agentCost * 0.28),
      currency: input.currency,
      cabin: input.cabin,
      baggage: input.cabin === "ECONOMY" ? "1 checked bag" : "2 checked bags",
      seatsRemaining: 4 + index,
      lastTicketingDate: ticketing.toISOString().slice(0, 10),
      fareType: "Demo published fare",
      legs,
    };
  });

  return {
    offers,
    source: "demo",
    message: "Demo fares are estimates for testing. Add Amadeus credentials for live availability and pricing.",
    searchedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const parsed = searchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the flight search details." }, { status: 400 });
    }
    const result = await searchAmadeus(parsed.data as FlightSearchInput);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flight search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
