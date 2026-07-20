"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, FileText, Plane, Search, Users } from "lucide-react";
import { Field } from "@/components/forms/Field";
import { money, travellersLabel } from "@/lib/format";
import { rateForCurrency } from "@/lib/fx";
import {
  CABIN_LABELS,
  formatFlightDuration,
  rankFlightOffers,
  totalDuration,
  totalStops,
  type FlightCabin,
  type FlightSearchResponse,
} from "@/lib/flights";
import { sellingFromMarkup } from "@/lib/quotation";
import type { Currency } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function airportCode(value: string): string {
  return value.match(/\(([A-Z]{3})\)/i)?.[1]?.toUpperCase()
    ?? (/^[A-Z]{3}$/i.test(value.trim()) ? value.trim().toUpperCase() : "");
}

function timeLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function sourceLabel(source: FlightSearchResponse["source"]): string {
  return source === "live" ? "Live fare" : source === "test" ? "Amadeus test fare" : "Demo estimate";
}

export function FlightFinder() {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const requestedEnquiry = ws.enquiry(params.get("enquiry") ?? "");
  const fallbackEnquiry = ws.data.enquiries.find((enquiry) => enquiry.status === "open" && enquiry.service === "flights");
  const initial = requestedEnquiry ?? fallbackEnquiry;
  const [enquiryId, setEnquiryId] = useState(initial?.id ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? ws.data.customers[0]?.id ?? "");
  const [origin, setOrigin] = useState(airportCode(initial?.origin ?? "") || "NBO");
  const [destination, setDestination] = useState(airportCode(initial?.destination ?? "") || "DXB");
  const [departureDate, setDepartureDate] = useState(initial?.travelStartDate || futureDate(30));
  const [returnDate, setReturnDate] = useState(initial?.travelEndDate || futureDate(37));
  const [adults, setAdults] = useState(initial?.travellers.adults ?? 1);
  const [children, setChildren] = useState(initial?.travellers.children ?? 0);
  const [infants, setInfants] = useState(initial?.travellers.infants ?? 0);
  const [cabin, setCabin] = useState<FlightCabin>("ECONOMY");
  const [currency, setCurrency] = useState<Currency>("KES");
  const [directOnly, setDirectOnly] = useState(false);
  const [markupPct, setMarkupPct] = useState(6);
  const [ticketingFee, setTicketingFee] = useState(2_500);
  const [result, setResult] = useState<FlightSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranked = useMemo(() => rankFlightOffers(result?.offers ?? []), [result]);
  const travellers = { adults, children, infants };

  useEffect(() => setTicketingFee(currency === "KES" ? 2_500 : currency === "USD" ? 25 : 20), [currency]);

  const applyEnquiry = (id: string) => {
    setEnquiryId(id);
    const enquiry = ws.enquiry(id);
    if (!enquiry) return;
    setCustomerId(enquiry.customerId);
    setOrigin(airportCode(enquiry.origin));
    setDestination(airportCode(enquiry.destination));
    setDepartureDate(enquiry.travelStartDate);
    setReturnDate(enquiry.travelEndDate);
    setAdults(enquiry.travellers.adults);
    setChildren(enquiry.travellers.children);
    setInfants(enquiry.travellers.infants);
    setResult(null);
  };

  const searchFlights = async () => {
    setError(null);
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
      setError("Use three-letter airport codes, for example NBO and DXB.");
      return;
    }
    if (!departureDate) {
      setError("Add a departure date.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, departureDate, returnDate: returnDate || undefined, adults, children, infants, cabin, currency, directOnly }),
      });
      const body = await response.json() as FlightSearchResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Flight search failed.");
      setResult(body);
      if (!body.offers.length) setError("No fares matched this search. Try nearby dates or allow connecting flights.");
    } catch (searchError) {
      setResult(null);
      setError(searchError instanceof Error ? searchError.message : "Flight search failed.");
    } finally {
      setLoading(false);
    }
  };

  const createDraftQuotation = () => {
    if (!customerId) {
      setError("Select a customer before creating the quotation.");
      return;
    }
    if (!ranked.length) return;
    const linkedEnquiry = ws.enquiry(enquiryId);
    const quoteId = ws.createQuotation({
      quotation: {
        customerId,
        enquiryId: linkedEnquiry?.id,
        destination: `${origin} to ${destination}`,
        travelStartDate: departureDate,
        travelEndDate: returnDate,
        travellers,
        currency,
        exchangeRateToKes: rateForCurrency(currency),
        validUntil: futureDate(1),
        createdById: ws.currentUser.id,
        depositPct: 100,
        exclusions: ["Travel insurance", "Visas", "Baggage beyond the stated allowance"],
        terms: "Flight fares are subject to availability until ticketed. Airavat will recheck the fare before payment and ticketing. Ticket changes and refunds follow the airline fare rules.",
        selectedOptionLabel: "A",
        status: "draft",
      },
      options: ranked.map(({ label, title, offer }) => ({
        label,
        name: `${title}: ${offer.airline}`,
        note: `${totalStops(offer) === 0 ? "Direct" : `${totalStops(offer)} stops`} | ${offer.baggage}`,
        recommended: label === "A",
      })),
      items: ranked.flatMap(({ label, offer }) => {
        const route = offer.legs.map((leg) => `${leg.origin}-${leg.destination} ${dateLabel(leg.departure)} ${timeLabel(leg.departure)}-${timeLabel(leg.arrival)}`).join("; ");
        const flightNumbers = offer.legs.flatMap((leg) => leg.flightNumbers).join(" / ");
        return [
          {
            optionLabel: label,
            type: "flight" as const,
            supplier: offer.airline,
            description: `${flightNumbers} | ${route} | ${CABIN_LABELS[offer.cabin]} | ${travellersLabel(travellers)}`,
            startDate: departureDate,
            endDate: returnDate || undefined,
            quantity: 1,
            costPrice: offer.agentCost,
            markupPct,
            sellingPrice: sellingFromMarkup(offer.agentCost, markupPct),
            taxPct: 0,
            notes: `${sourceLabel(offer.source)} checked ${new Date(result?.searchedAt ?? Date.now()).toLocaleString("en-GB")}. ${offer.baggage}. Ticket by ${offer.lastTicketingDate ?? "airline deadline"}.`,
            cancellation: "Confirm change and refund rules before ticketing.",
          },
          ...(ticketingFee > 0 ? [{
            optionLabel: label,
            type: "service-fee" as const,
            supplier: "Airavat",
            description: "Flight reservation and ticketing service",
            quantity: 1,
            costPrice: 0,
            markupPct: 0,
            sellingPrice: ticketingFee,
            taxPct: 0,
          }] : []),
        ];
      }),
    });
    router.push(`/quotations/${quoteId}`);
  };

  const customer = ws.customer(customerId);
  const openEnquiries = ws.data.enquiries.filter((enquiry) => enquiry.status === "open");

  return (
    <div className="space-y-5">
      <section className="border-y border-line bg-surface px-4 py-5 sm:px-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <Field label="Enquiry"><select className="field" value={enquiryId} onChange={(event) => applyEnquiry(event.target.value)}><option value="">No linked enquiry</option>{openEnquiries.map((enquiry) => <option key={enquiry.id} value={enquiry.id}>{enquiry.ref} - {ws.customer(enquiry.customerId)?.name}</option>)}</select></Field>
          <Field label="Customer"><select className="field" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{ws.data.customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="From" hint="Three-letter airport code"><input className="field uppercase" maxLength={3} value={origin} onChange={(event) => setOrigin(event.target.value.toUpperCase())} placeholder="NBO" /></Field>
          <Field label="To" hint="Three-letter airport code"><input className="field uppercase" maxLength={3} value={destination} onChange={(event) => setDestination(event.target.value.toUpperCase())} placeholder="DXB" /></Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Field label="Depart"><input className="field" type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} /></Field>
          <Field label="Return" optional><input className="field" type="date" value={returnDate} min={departureDate} onChange={(event) => setReturnDate(event.target.value)} /></Field>
          <Field label="Adults"><input className="field" type="number" min={1} max={9} value={adults} onChange={(event) => setAdults(Number(event.target.value))} /></Field>
          <Field label="Children"><input className="field" type="number" min={0} max={8} value={children} onChange={(event) => setChildren(Number(event.target.value))} /></Field>
          <Field label="Infants"><input className="field" type="number" min={0} max={8} value={infants} onChange={(event) => setInfants(Number(event.target.value))} /></Field>
          <Field label="Cabin"><select className="field" value={cabin} onChange={(event) => setCabin(event.target.value as FlightCabin)}>{Object.entries(CABIN_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Currency"><select className="field" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>{(["KES", "USD", "EUR", "GBP"] as Currency[]).map((item) => <option key={item}>{item}</option>)}</select></Field>
          <div className="flex items-end"><label className="flex min-h-10 items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-[var(--color-terracotta)]" checked={directOnly} onChange={(event) => setDirectOnly(event.target.checked)} />Direct only</label></div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-4">
          <div className="w-32"><Field label="Markup %"><input className="field" type="number" min={0} max={100} value={markupPct} onChange={(event) => setMarkupPct(Number(event.target.value))} /></Field></div>
          <div className="w-44"><Field label={`Ticketing fee (${currency})`}><input className="field" type="number" min={0} value={ticketingFee} onChange={(event) => setTicketingFee(Number(event.target.value))} /></Field></div>
          <div className="ml-auto"><button type="button" className="btn btn-primary hover:btn-primary-hover min-w-36" onClick={searchFlights} disabled={loading}><Search className="size-4" aria-hidden /> {loading ? "Searching..." : "Search fares"}</button></div>
        </div>
      </section>

      {error ? <p className="rounded-lg border-l-2 border-error bg-error/5 px-3 py-2 text-sm text-error" role="alert">{error}</p> : null}
      {result?.message ? <p className={`rounded-lg border-l-2 px-3 py-2 text-sm ${result.source === "demo" ? "border-warning bg-warning/5 text-warning" : "border-info bg-info/5 text-info"}`}>{result.message}</p> : null}

      {ranked.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold">Best three options for {customer?.name}</h2><p className="mt-0.5 text-sm text-muted">Agent cost stays internal. The client quotation uses the selling price below.</p></div>
            <button type="button" className="btn btn-primary hover:btn-primary-hover" onClick={createDraftQuotation}><FileText className="size-4" aria-hidden /> Create 3-option draft</button>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {ranked.map(({ label, title, offer }) => {
              const sellingPrice = sellingFromMarkup(offer.agentCost, markupPct) + ticketingFee;
              return (
                <article key={offer.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3"><div className="flex items-center gap-2"><span className={label === "A" ? "badge badge-success" : "badge badge-info"}>Option {label}</span><span className="text-sm font-bold">{title}</span></div><span className="text-xs font-semibold text-muted">{sourceLabel(offer.source)}</span></div>
                  <div className="space-y-4 p-4">
                    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Plane className="size-5 text-terracotta" aria-hidden /><div><p className="font-bold">{offer.airline}</p><p className="text-xs text-muted">{CABIN_LABELS[offer.cabin]} | {offer.fareType}</p></div></div>{offer.seatsRemaining ? <span className="text-xs font-semibold text-warning">{offer.seatsRemaining} seats left</span> : null}</div>
                    <div className="space-y-3">{offer.legs.map((leg, index) => <div key={`${offer.id}-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div><p className="tnum text-lg font-bold">{timeLabel(leg.departure)}</p><p className="text-xs text-muted">{dateLabel(leg.departure)} | {leg.origin}</p></div><div className="min-w-24 text-center"><p className="text-[11px] text-muted">{formatFlightDuration(leg.durationMinutes)}</p><div className="my-1 flex items-center"><span className="h-px flex-1 bg-line" /><ArrowRight className="mx-1 size-3 text-muted" /><span className="h-px flex-1 bg-line" /></div><p className="text-[11px] text-muted">{leg.stops === 0 ? "Direct" : `${leg.stops} stops`}</p></div><div className="text-right"><p className="tnum text-lg font-bold">{timeLabel(leg.arrival)}</p><p className="text-xs text-muted">{dateLabel(leg.arrival)} | {leg.destination}</p></div></div>)}</div>
                    <div className="grid grid-cols-2 gap-2 border-y border-line py-3 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" /> {formatFlightDuration(totalDuration(offer))} total</span><span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" /> {offer.baggage}</span><span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {travellersLabel(travellers)}</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Ticket by {offer.lastTicketingDate ?? "TBC"}</span></div>
                    <dl className="space-y-1.5 text-sm"><div className="flex justify-between"><dt className="text-muted">Agent cost</dt><dd className="tnum font-semibold">{money(offer.agentCost, currency)}</dd></div><div className="flex justify-between"><dt className="text-muted">Markup + fee</dt><dd className="tnum">{money(sellingPrice - offer.agentCost, currency)}</dd></div><div className="flex justify-between border-t border-line pt-2"><dt className="font-bold">Client price</dt><dd className="tnum text-lg font-bold">{money(sellingPrice, currency)}</dd></div></dl>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-xs text-muted">Fares and seats are subject to availability until ticketed. Recheck the fare before taking payment.</p>
        </div>
      ) : !loading ? (
        <div className="flex min-h-56 flex-col items-center justify-center border-y border-line bg-surface px-6 text-center"><Plane className="mb-3 size-8 text-muted" aria-hidden /><p className="font-semibold">Search once, quote three options</p><p className="mt-1 max-w-md text-sm text-muted">The finder ranks a recommended fare, a lower-price alternative, and a faster journey, then prepares the quotation automatically.</p></div>
      ) : null}
    </div>
  );
}
