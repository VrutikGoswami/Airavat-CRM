"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Check,
  ChevronRight,
  FileText,
  Filter,
  ImageIcon,
  Minus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { Field } from "@/components/forms/Field";
import { Modal } from "@/components/ui/Modal";
import {
  HOTEL_MARKUP_PERCENT,
  calculateHotelRate,
  hotelNights,
  type HotelMetadata,
  type HotelRateOffer,
  type HotelSearchResponse,
  type HotelSearchResult,
} from "@/lib/hotels";
import { rateForCurrency } from "@/lib/fx";
import type { Currency, Enquiry } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

const MEAL_PLANS = ["Any", "Room Only", "Bed & Breakfast", "Half Board", "Full Board", "All Inclusive"];
const CURRENCIES: Currency[] = ["KES", "USD", "EUR", "GBP"];

type SortMode = "recommended" | "lowest" | "stars";
type DrawerMode = "filters" | "sort" | null;
type SelectedRate = { hotel: HotelMetadata; rate: HotelRateOffer; rooms: number };

function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function numberFromBudget(value: string): number | null {
  const matches = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;
  const values = matches.map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function mealFromEnquiry(enquiry?: Enquiry): string {
  const text = `${enquiry?.requirements ?? ""} ${enquiry?.budget ?? ""}`.toLowerCase();
  return MEAL_PLANS.find((meal) => meal !== "Any" && text.includes(meal.toLowerCase())) ?? "Any";
}

function websiteHotelDetails(enquiry?: Enquiry): { rooms: number; preference: string } {
  if (!enquiry) return { rooms: 1, preference: "" };
  try {
    const payload = JSON.parse(enquiry.requirements) as {
      notes?: string;
      service_details?: { rooms?: number; roomConfiguration?: string; mealPlan?: string };
    };
    const details = payload.service_details ?? {};
    return {
      rooms: Number.isInteger(details.rooms) && Number(details.rooms) > 0 ? Number(details.rooms) : 1,
      preference: [details.roomConfiguration, details.mealPlan, payload.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  } catch {
    return { rooms: 1, preference: enquiry.requirements.toLowerCase() };
  }
}

function isCustomerSelection(hotel: HotelMetadata, rate: HotelRateOffer, preference: string): boolean {
  if (!preference || !preference.includes(hotel.name.toLowerCase())) return false;
  return preference.includes(rate.roomType.toLowerCase()) || preference.includes(rate.occupancy.toLowerCase());
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount === null || !Number.isFinite(amount)) return "Needs confirmation";
  return `${currency} ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Math.round(amount))}`;
}

function cancellationSummary(value: string | null): string {
  return value?.trim() || "Cancellation terms not supplied";
}

function resultBestRate(result: HotelSearchResult): HotelRateOffer {
  return [...result.rates].sort((a, b) => {
    if (a.clientTotal === null) return 1;
    if (b.clientTotal === null) return -1;
    return a.clientTotal - b.clientTotal;
  })[0];
}

function imageStyle(url?: string): React.CSSProperties | undefined {
  return url ? { backgroundImage: `url("${url.replaceAll('"', "%22")}")` } : undefined;
}

function HotelImage({ hotel, className }: { hotel: HotelMetadata; className: string }) {
  const url = hotel.imageUrls[0];
  return (
    <div className={`relative bg-surface-2 bg-cover bg-center ${className}`} style={imageStyle(url)}>
      {!url ? <div className="absolute inset-0 flex items-center justify-center text-muted"><ImageIcon className="size-8" aria-hidden /></div> : null}
    </div>
  );
}

function Stars({ count }: { count: number | null }) {
  if (!count) return <span className="text-xs font-semibold text-muted">Category not set</span>;
  return <span className="inline-flex" aria-label={`${count} star category`}>{Array.from({ length: count }, (_, index) => <Star key={index} className="size-3.5 fill-warning text-warning" aria-hidden />)}</span>;
}

function FilterControls({
  stars,
  setStars,
  budget,
  setBudget,
  mealPlan,
  setMealPlan,
  freeCancellation,
  setFreeCancellation,
  amenities,
  selectedAmenities,
  setSelectedAmenities,
}: {
  stars: number[];
  setStars: (value: number[]) => void;
  budget: string;
  setBudget: (value: string) => void;
  mealPlan: string;
  setMealPlan: (value: string) => void;
  freeCancellation: boolean;
  setFreeCancellation: (value: boolean) => void;
  amenities: string[];
  selectedAmenities: string[];
  setSelectedAmenities: (value: string[]) => void;
}) {
  const toggleStar = (value: number) => setStars(stars.includes(value) ? stars.filter((star) => star !== value) : [...stars, value]);
  const toggleAmenity = (value: string) => setSelectedAmenities(selectedAmenities.includes(value) ? selectedAmenities.filter((item) => item !== value) : [...selectedAmenities, value]);
  return (
    <div className="space-y-5">
      <div>
        <p className="field-label">Star category</p>
        <div className="space-y-2">{[5, 4, 3].map((star) => <label key={star} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--color-terracotta)]" checked={stars.includes(star)} onChange={() => toggleStar(star)} />{star} stars</label>)}</div>
      </div>
      <Field label="Maximum total" optional><input className="field" type="number" min={0} value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="No limit" /></Field>
      <Field label="Meal plan"><select className="field" value={mealPlan} onChange={(event) => setMealPlan(event.target.value)}>{MEAL_PLANS.map((meal) => <option key={meal}>{meal}</option>)}</select></Field>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-terracotta)]" checked={freeCancellation} onChange={(event) => setFreeCancellation(event.target.checked)} /><span>Free cancellation</span></label>
      {amenities.length ? <div><p className="field-label">Amenities</p><div className="space-y-2">{amenities.slice(0, 10).map((amenity) => <label key={amenity} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--color-terracotta)]" checked={selectedAmenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />{amenity}</label>)}</div></div> : null}
    </div>
  );
}

export function HotelFinder() {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const requestedEnquiry = ws.enquiry(params.get("enquiry") ?? "");
  const fallbackEnquiry = ws.data.enquiries.find((enquiry) => enquiry.status === "open" && ["hotel", "holiday-package", "safari"].includes(enquiry.service));
  const initial = requestedEnquiry ?? fallbackEnquiry;
  const initialHotelDetails = websiteHotelDetails(initial);
  const availabilityMode = Boolean(requestedEnquiry?.service === "hotel");
  const autoSearchRef = useRef(false);

  const [enquiryId, setEnquiryId] = useState(initial?.id ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? ws.data.customers[0]?.id ?? "");
  const [destination, setDestination] = useState(initial?.destination ?? "Diani Beach");
  const [checkIn, setCheckIn] = useState(initial?.travelStartDate || futureDate(30));
  const [checkOut, setCheckOut] = useState(initial?.travelEndDate || futureDate(35));
  const [rooms, setRooms] = useState(initialHotelDetails.rooms);
  const [adults, setAdults] = useState(initial?.travellers.adults ?? 2);
  const [children, setChildren] = useState(initial?.travellers.children ?? 0);
  const [market, setMarket] = useState("Resident");
  const [mealPlan, setMealPlan] = useState(mealFromEnquiry(initial));
  const [budget, setBudget] = useState(numberFromBudget(initial?.budget ?? "")?.toString() ?? "");
  const [result, setResult] = useState<HotelSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("recommended");
  const [filterStars, setFilterStars] = useState<number[]>([]);
  const [filterBudget, setFilterBudget] = useState("");
  const [filterMeal, setFilterMeal] = useState("Any");
  const [freeCancellation, setFreeCancellation] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [openHotelId, setOpenHotelId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedRate[]>([]);
  const [selectionReviewOpen, setSelectionReviewOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const applyEnquiry = (id: string) => {
    setEnquiryId(id);
    const enquiry = ws.enquiry(id);
    if (!enquiry) return;
    setCustomerId(enquiry.customerId);
    setDestination(enquiry.destination);
    setCheckIn(enquiry.travelStartDate);
    setCheckOut(enquiry.travelEndDate);
    setAdults(enquiry.travellers.adults);
    setChildren(enquiry.travellers.children);
    setRooms(websiteHotelDetails(enquiry).rooms);
    setMealPlan(mealFromEnquiry(enquiry));
    setBudget(numberFromBudget(enquiry.budget)?.toString() ?? "");
    setResult(null);
    setSelected([]);
  };

  const searchHotels = async () => {
    setError(null);
    if (destination.trim().length < 2) return setError("Add a destination.");
    if (hotelNights(checkIn, checkOut) < 1) return setError("Check-out must be after check-in.");
    if (rooms < 1 || adults < 1 || children < 0 || rooms > adults + children) return setError("Check rooms and traveller occupancy.");
    setLoading(true);
    setSelected([]);
    try {
      const response = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, checkIn, checkOut, rooms, adults, children, market, mealPlan, budget: budget ? Number(budget) : null }),
      });
      const body = await response.json() as HotelSearchResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Hotel search failed.");
      setResult(body);
      setFilterBudget(budget);
      setFilterMeal("Any");
      if (availabilityMode && body.results.length) {
        const preference = websiteHotelDetails(requestedEnquiry).preference;
        const preferred = body.results.find((item) =>
          item.rates.some((rate) => isCustomerSelection(item.hotel, rate, preference)),
        );
        setOpenHotelId((preferred ?? body.results[0]).hotel.id);
      }
      if (!body.results.length) setError("No approved supplier rates matched. Try another meal plan, market, or date range.");
    } catch (searchError) {
      setResult(null);
      setError(searchError instanceof Error ? searchError.message : "Hotel search failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!availabilityMode || autoSearchRef.current) return;
    autoSearchRef.current = true;
    void searchHotels();
    // Search once from the enquiry values captured on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityMode]);

  const amenities = useMemo(() => [...new Set(result?.results.flatMap((item) => item.hotel.amenities) ?? [])].sort(), [result]);
  const visibleResults = useMemo(() => {
    const maxBudget = filterBudget ? Number(filterBudget) : null;
    const filtered = (result?.results ?? []).filter((item) => {
      const matchingRates = item.rates.filter((rate) => {
        if (filterMeal !== "Any" && rate.mealPlan !== filterMeal) return false;
        if (freeCancellation && !rate.freeCancellation) return false;
        if (maxBudget && (rate.clientTotal === null || rate.clientTotal > maxBudget)) return false;
        return true;
      });
      if (!matchingRates.length) return false;
      if (filterStars.length && (!item.hotel.starRating || !filterStars.includes(item.hotel.starRating))) return false;
      return selectedAmenities.every((amenity) => item.hotel.amenities.includes(amenity));
    });
    return [...filtered].sort((a, b) => {
      const aRate = resultBestRate(a);
      const bRate = resultBestRate(b);
      if (sort === "lowest") return (aRate.clientTotal ?? Number.MAX_SAFE_INTEGER) - (bRate.clientTotal ?? Number.MAX_SAFE_INTEGER);
      if (sort === "stars") return (b.hotel.starRating ?? 0) - (a.hotel.starRating ?? 0);
      const aScore = (a.hotel.starRating ?? 0) + (aRate.freeCancellation ? 2 : 0) + (a.hotel.imageUrls.length ? 1 : 0);
      const bScore = (b.hotel.starRating ?? 0) + (bRate.freeCancellation ? 2 : 0) + (b.hotel.imageUrls.length ? 1 : 0);
      return bScore - aScore || (aRate.clientTotal ?? Number.MAX_SAFE_INTEGER) - (bRate.clientTotal ?? Number.MAX_SAFE_INTEGER);
    });
  }, [filterBudget, filterMeal, filterStars, freeCancellation, result, selectedAmenities, sort]);

  const openResult = result?.results.find((item) => item.hotel.id === openHotelId) ?? null;
  const toggleRate = (hotel: HotelMetadata, rate: HotelRateOffer) => {
    if (rate.requiresConfirmation) return setError("Confirm this rate basis with the supplier before adding it to a quotation.");
    const existing = selected.find((item) => item.rate.id === rate.id);
    if (existing) return setSelected(selected.filter((item) => item.rate.id !== rate.id));
    if (selected.length >= 3) return setError("A quotation can contain up to three hotel options.");
    if (selected.some((item) => item.rate.currency !== rate.currency)) return setError("Keep all quotation options in the same supplier currency.");
    setError(null);
    setSelected([...selected, { hotel, rate, rooms }]);
    if (enquiryId) {
      const linked = ws.enquiry(enquiryId);
      if (linked) {
        const taskTitle = `Confirm availability: ${hotel.name} - ${rate.roomType}`;
        ws.setWaitingOn(enquiryId, "supplier");
        ws.addNote(
          enquiryId,
          `Availability check requested for ${hotel.name}, ${rate.roomType}, ${rate.mealPlan}, ${rooms} room${rooms === 1 ? "" : "s"}. Automation handoff queued for supplier confirmation.`,
        );
        if (!ws.data.tasks.some((task) => !task.done && task.enquiryId === enquiryId && task.title === taskTitle)) {
          ws.createTask({
            title: taskTitle,
            type: "confirm-supplier",
            customerId: linked.customerId,
            enquiryId,
            assignedToId: ws.currentUser.id,
            dueAt: new Date().toISOString(),
            priority: "high",
          });
        }
      }
      setOpenHotelId(null);
    }
  };

  const selectedTotals = (item: SelectedRate) => calculateHotelRate({
    amount: item.rate.amount,
    unitBasis: item.rate.unitBasis,
    nights: hotelNights(checkIn, checkOut),
    rooms: item.rooms,
    adults,
    children,
    markupPercent: HOTEL_MARKUP_PERCENT,
  });

  const updateSelectedRooms = (rateId: string, nextRooms: number) => setSelected(selected.map((item) => item.rate.id === rateId ? { ...item, rooms: Math.min(10, Math.max(1, nextRooms)) } : item));

  const updateHotel = (hotel: HotelMetadata) => {
    setResult((current) => current ? { ...current, results: current.results.map((item) => item.hotel.id === hotel.id ? { ...item, hotel } : item) } : current);
    setSelected((current) => current.map((item) => item.hotel.id === hotel.id ? { ...item, hotel } : item));
  };

  const createQuotation = () => {
    setCreating(true);
    setError(null);
    try {
      if (!customerId) throw new Error("Select a customer before creating the quotation.");
      if (!selected.length) throw new Error("Select at least one hotel rate.");
      const currency = selected[0].rate.currency as Currency;
      if (!CURRENCIES.includes(currency)) throw new Error(`${currency} is not supported by the quotation currency list yet.`);
      const labels = ["A", "B", "C"] as const;
      const linkedEnquiry = ws.enquiry(enquiryId);
      const quoteId = ws.createQuotation({
        quotation: {
          customerId,
          enquiryId: linkedEnquiry?.id,
          destination,
          travelStartDate: checkIn,
          travelEndDate: checkOut,
          travellers: { adults, children, infants: linkedEnquiry?.travellers.infants ?? 0 },
          currency,
          exchangeRateToKes: rateForCurrency(currency),
          validUntil: futureDate(7),
          createdById: ws.currentUser.id,
          depositPct: 30,
          exclusions: ["Transport unless stated", "Travel insurance", "Extras and meals not stated"],
          terms: "Hotel rates and rooms are subject to supplier confirmation. Airavat will confirm availability, taxes and payment deadlines before taking payment.",
          selectedOptionLabel: "A",
          status: "draft",
        },
        options: selected.map((item, index) => ({
          label: labels[index],
          name: item.hotel.name,
          note: `${item.rate.roomType} | ${item.rate.mealPlan} | ${cancellationSummary(item.rate.cancellationPolicy)}`,
          recommended: index === 0,
        })),
        items: selected.map((item, index) => {
          const totals = selectedTotals(item);
          if (totals.netTotal === null || totals.clientTotal === null) throw new Error(`Confirm the rate basis for ${item.hotel.name}.`);
          return {
            optionLabel: labels[index],
            type: "hotel" as const,
            supplier: item.rate.supplierName,
            description: `${item.hotel.name} - ${item.rate.roomType}, ${item.rate.mealPlan}; ${item.rooms} room${item.rooms === 1 ? "" : "s"}, ${result?.nights ?? hotelNights(checkIn, checkOut)} nights. Tax: ${item.rate.taxIncluded.toLowerCase()}; commission: ${item.rate.commissionIncluded.toLowerCase()}.`,
            startDate: checkIn,
            endDate: checkOut,
            quantity: 1,
            costPrice: totals.netTotal,
            markupPct: HOTEL_MARKUP_PERCENT,
            sellingPrice: totals.clientTotal,
            taxPct: 0,
            notes: "Rate matched; confirm availability.",
            cancellation: cancellationSummary(item.rate.cancellationPolicy),
          };
        }),
      });
      router.push(`/quotations/${quoteId}`);
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "Could not create the quotation.");
      setCreating(false);
    }
  };

  const filterProps = { stars: filterStars, setStars: setFilterStars, budget: filterBudget, setBudget: setFilterBudget, mealPlan: filterMeal, setMealPlan: setFilterMeal, freeCancellation, setFreeCancellation, amenities, selectedAmenities, setSelectedAmenities };
  const activeFilterCount = filterStars.length + selectedAmenities.length + (filterBudget ? 1 : 0) + (filterMeal !== "Any" ? 1 : 0) + (freeCancellation ? 1 : 0);
  const openEnquiries = ws.data.enquiries.filter((enquiry) => enquiry.status === "open");

  return (
    <div className={selected.length ? "space-y-5 pb-24 xl:pb-0" : "space-y-5"}>
      <section className="border-y border-line bg-surface px-4 py-5 sm:px-5">
        <div className="grid gap-4 lg:grid-cols-4 xl:grid-cols-6">
          <Field label="Enquiry"><select className="field" value={enquiryId} onChange={(event) => applyEnquiry(event.target.value)}><option value="">No linked enquiry</option>{openEnquiries.map((enquiry) => <option key={enquiry.id} value={enquiry.id}>{enquiry.ref} - {ws.customer(enquiry.customerId)?.name}</option>)}</select></Field>
          <Field label="Destination"><input className="field" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Diani Beach" /></Field>
          <Field label="Check-in"><input className="field" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></Field>
          <Field label="Check-out"><input className="field" type="date" min={checkIn} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></Field>
          <Field label="Rooms"><input className="field" type="number" min={1} max={10} value={rooms} onChange={(event) => setRooms(Number(event.target.value))} /></Field>
          <Field label="Budget" optional><input className="field" type="number" min={0} value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Total stay" /></Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Adults"><input className="field" type="number" min={1} max={40} value={adults} onChange={(event) => setAdults(Number(event.target.value))} /></Field>
          <Field label="Children"><input className="field" type="number" min={0} max={40} value={children} onChange={(event) => setChildren(Number(event.target.value))} /></Field>
          <Field label="Residency / market"><input className="field" value={market} onChange={(event) => setMarket(event.target.value)} placeholder="Resident" /></Field>
          <Field label="Meal plan"><select className="field" value={mealPlan} onChange={(event) => setMealPlan(event.target.value)}>{MEAL_PLANS.map((meal) => <option key={meal}>{meal}</option>)}</select></Field>
          <Field label="Customer"><select className="field" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Select customer</option>{ws.data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></Field>
          <div className="flex items-end"><button type="button" className="btn btn-primary hover:btn-primary-hover w-full" onClick={searchHotels} disabled={loading}><Search className="size-4" aria-hidden />{loading ? "Searching..." : "Search hotels"}</button></div>
        </div>
      </section>

      {error ? <p className="rounded-lg border-l-2 border-error bg-error/5 px-3 py-2 text-sm text-error" role="alert">{error}</p> : null}
      {result ? <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-2 px-3 py-2 text-sm ${result.source === "demo" ? "border-warning bg-warning/5 text-warning" : "border-info bg-info/5 text-info"}`}><span><strong>{result.source === "demo" ? "SAMPLE DATA" : "SUPPLIER RATE"}</strong> - {result.notice}</span><span>{result.nights} nights</span></div> : null}

      {result && result.results.length ? (
        <div className="grid items-start gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_270px]">
          <aside className="sticky top-4 hidden border-r border-line pr-5 lg:block"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Filters</h2>{activeFilterCount ? <button className="text-xs font-semibold text-terracotta" onClick={() => { setFilterStars([]); setFilterBudget(""); setFilterMeal("Any"); setFreeCancellation(false); setSelectedAmenities([]); }}>Clear</button> : null}</div><FilterControls {...filterProps} /></aside>

          <main className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm"><strong>{visibleResults.length}</strong> properties matched</p>
              <div className="flex gap-2 lg:hidden"><button className="btn btn-ghost" onClick={() => setDrawer("filters")}><Filter className="size-4" /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</button><button className="btn btn-ghost" onClick={() => setDrawer("sort")}><SlidersHorizontal className="size-4" /> Sort</button></div>
              <label className="hidden items-center gap-2 text-sm lg:flex"><span className="text-muted">Sort</span><select className="field w-44" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="recommended">Recommended</option><option value="lowest">Lowest total</option><option value="stars">Highest stars</option></select></label>
            </div>
            {visibleResults.map((item) => {
              const rate = resultBestRate(item);
              const margin = rate.clientTotal !== null && rate.netTotal !== null ? rate.clientTotal - rate.netTotal : null;
              return (
                <article key={item.hotel.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="grid sm:grid-cols-[190px_minmax(0,1fr)] 2xl:grid-cols-[190px_minmax(0,1fr)_190px]">
                    <HotelImage hotel={item.hotel} className="aspect-[16/9] min-h-40 sm:aspect-auto sm:h-full" />
                    <div className="min-w-0 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2"><div><Stars count={item.hotel.starRating} /><h3 className="mt-1 text-lg font-bold">{item.hotel.name}</h3><p className="text-sm font-semibold text-terracotta">{item.hotel.area || item.hotel.city || item.hotel.destinationName}</p></div><span className="badge badge-info">{item.rates.length} rate{item.rates.length === 1 ? "" : "s"}</span></div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted">{item.hotel.shortDescription || "Property details have not been added yet."}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">{item.hotel.amenities.slice(0, 4).map((amenity) => <span key={amenity} className="rounded bg-surface-2 px-2 py-1 text-xs font-medium">{amenity}</span>)}{!item.hotel.amenities.length ? <span className="text-xs text-muted">Amenities not supplied</span> : null}</div>
                      <div className="mt-4 border-t border-line pt-3 text-sm"><p className="font-bold">{rate.roomType} <span className="font-normal text-muted">| {rate.mealPlan}</span></p><p className={rate.freeCancellation ? "mt-1 text-xs font-semibold text-success" : "mt-1 text-xs text-muted"}>{cancellationSummary(rate.cancellationPolicy)}</p></div>
                    </div>
                    <div className="flex flex-col justify-between border-t border-line p-4 text-right sm:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
                      <div><p className="text-xs text-muted">Total for {result.nights} nights</p><p className="tnum mt-1 text-xl font-bold">{formatMoney(rate.clientTotal, rate.currency)}</p><p className="mt-1 text-xs text-muted">{rate.calculationNote}</p></div>
                      <dl className="my-3 space-y-1 text-xs"><div className="flex justify-between"><dt className="text-muted">Supplier total</dt><dd className="tnum">{formatMoney(rate.netTotal, rate.currency)}</dd></div><div className="flex justify-between"><dt className="text-muted">Pricing</dt><dd>{rate.pricingBasis === "rack" ? "Rack" : "Net"} + {HOTEL_MARKUP_PERCENT}%</dd></div><div className="flex justify-between"><dt className="text-muted">Margin</dt><dd className="tnum">{formatMoney(margin, rate.currency)}</dd></div></dl>
                      <button className="btn btn-primary hover:btn-primary-hover w-full" onClick={() => setOpenHotelId(item.hotel.id)}>View rooms <ChevronRight className="size-4" /></button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!visibleResults.length ? <div className="border-y border-line bg-surface px-6 py-12 text-center"><p className="font-semibold">No properties match these filters</p><p className="mt-1 text-sm text-muted">Clear a filter to see the approved rates from this search.</p></div> : null}
          </main>

          <SelectionSummary selected={selected} selectedTotals={selectedTotals} updateRooms={updateSelectedRooms} remove={(id) => setSelected(selected.filter((item) => item.rate.id !== id))} createQuotation={createQuotation} creating={creating} className="sticky top-4 hidden xl:block" />
        </div>
      ) : !loading ? (
        <div className="flex min-h-60 flex-col items-center justify-center border-y border-line bg-surface px-6 text-center"><Building2 className="mb-3 size-9 text-muted" aria-hidden /><p className="font-semibold">Find a rate, compare rooms, create the quote</p><p className="mt-1 max-w-md text-sm text-muted">Search approved supplier contracts by destination and stay details. Availability is confirmed with the supplier after selection.</p></div>
      ) : <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-48 animate-pulse rounded-lg border border-line bg-surface" />)}</div>}

      {selected.length ? <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface p-3 shadow-[0_-6px_20px_rgba(29,42,34,0.12)] xl:hidden"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3"><button className="min-w-0 text-left" onClick={() => setSelectionReviewOpen(true)}><p className="truncate font-bold">{selected.length} option{selected.length === 1 ? "" : "s"}</p><p className="text-xs font-semibold text-terracotta">Review rooms</p></button><button className="btn btn-primary hover:btn-primary-hover shrink-0" onClick={createQuotation} disabled={creating}><FileText className="size-4" />{creating ? "Creating..." : "Create draft"}</button></div></div> : null}

      <HotelDetails openResult={openResult} source={result?.source ?? "live"} selected={selected} rooms={rooms} preference={websiteHotelDetails(requestedEnquiry).preference} onClose={() => setOpenHotelId(null)} onToggle={toggleRate} onUpdateHotel={updateHotel} />
      <Modal open={selectionReviewOpen} title="Quotation options" onClose={() => setSelectionReviewOpen(false)} size="lg"><SelectionSummary selected={selected} selectedTotals={selectedTotals} updateRooms={updateSelectedRooms} remove={(id) => setSelected(selected.filter((item) => item.rate.id !== id))} createQuotation={createQuotation} creating={creating} /></Modal>

      {drawer ? <div className="fixed inset-0 z-[70] lg:hidden"><button className="absolute inset-0 bg-ink/40" aria-label="Close drawer" onClick={() => setDrawer(null)} /><div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-lg bg-surface p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-bold">{drawer === "filters" ? "Filter results" : "Sort results"}</h2><button className="row-hover rounded-md p-2" onClick={() => setDrawer(null)} aria-label="Close"><X className="size-4" /></button></div>{drawer === "filters" ? <FilterControls {...filterProps} /> : <div className="space-y-2">{([['recommended', 'Recommended'], ['lowest', 'Lowest total'], ['stars', 'Highest stars']] as const).map(([value, label]) => <label key={value} className="flex items-center gap-3 border-b border-line py-3 text-sm"><input type="radio" name="sort" className="size-4 accent-[var(--color-terracotta)]" checked={sort === value} onChange={() => setSort(value)} />{label}</label>)}</div>}<button className="btn btn-primary hover:btn-primary-hover mt-5 w-full" onClick={() => setDrawer(null)}>Show results</button></div></div> : null}
    </div>
  );
}

function SelectionSummary({ selected, selectedTotals, updateRooms, remove, createQuotation, creating, className }: { selected: SelectedRate[]; selectedTotals: (item: SelectedRate) => ReturnType<typeof calculateHotelRate>; updateRooms: (id: string, rooms: number) => void; remove: (id: string) => void; createQuotation: () => void; creating: boolean; className?: string }) {
  return <aside className={className}><div className="rounded-lg border border-line bg-surface p-4"><h2 className="font-bold">Quotation options</h2><p className="mt-1 text-xs text-muted">Select up to three room rates.</p>{selected.length ? <div className="mt-4 space-y-4">{selected.map((item, index) => { const totals = selectedTotals(item); return <div key={item.rate.id} className="border-t border-line pt-3"><div className="flex items-start justify-between gap-2"><div><span className="badge badge-info">Option {String.fromCharCode(65 + index)}</span><p className="mt-1 text-sm font-bold">{item.hotel.name}</p><p className="text-xs text-muted">{item.rate.roomType}</p></div><button className="row-hover rounded-md p-1 text-muted" onClick={() => remove(item.rate.id)} aria-label={`Remove ${item.hotel.name}`}><X className="size-4" /></button></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-muted">Rooms</span><div className="flex h-8 items-center rounded-md border border-line"><button className="h-full px-2" onClick={() => updateRooms(item.rate.id, item.rooms - 1)} aria-label="Decrease rooms"><Minus className="size-3" /></button><span className="tnum w-7 text-center text-sm font-semibold">{item.rooms}</span><button className="h-full px-2" onClick={() => updateRooms(item.rate.id, item.rooms + 1)} aria-label="Increase rooms"><Plus className="size-3" /></button></div></div><p className="tnum mt-2 text-right text-sm font-bold">{formatMoney(totals.clientTotal, item.rate.currency)}</p></div>; })}<button className="btn btn-primary hover:btn-primary-hover w-full" onClick={createQuotation} disabled={creating}><FileText className="size-4" />{creating ? "Creating..." : "Create draft quotation"}</button></div> : <div className="mt-4 rounded-lg bg-surface-2 px-3 py-6 text-center text-sm text-muted">Choose a room rate to begin.</div>}</div></aside>;
}

function HotelDetails({ openResult, source, selected, rooms, preference, onClose, onToggle, onUpdateHotel }: { openResult: HotelSearchResult | null; source: "live" | "demo"; selected: SelectedRate[]; rooms: number; preference: string; onClose: () => void; onToggle: (hotel: HotelMetadata, rate: HotelRateOffer) => void; onUpdateHotel: (hotel: HotelMetadata) => void }) {
  const [editing, setEditing] = useState(false);
  if (!openResult) return null;
  return <Modal open title={openResult.hotel.name} onClose={() => { setEditing(false); onClose(); }} size="xl"><div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><HotelImage hotel={openResult.hotel} className="aspect-[16/9] rounded-lg sm:col-span-2" />{openResult.hotel.imageUrls[1] ? <div className="aspect-[16/9] rounded-lg bg-surface-2 bg-cover bg-center sm:aspect-auto" style={imageStyle(openResult.hotel.imageUrls[1])} /> : <div className="flex min-h-28 items-center justify-center rounded-lg bg-surface-2 text-muted"><ImageIcon className="size-7" /></div>}</div><div className="flex flex-wrap items-start justify-between gap-4"><div><Stars count={openResult.hotel.starRating} /><p className="mt-1 text-sm font-semibold text-terracotta">{openResult.hotel.area || openResult.hotel.city || openResult.hotel.destinationName}</p><p className="mt-2 max-w-3xl text-sm text-muted">{openResult.hotel.shortDescription || "Add a short property summary for staff."}</p><div className="mt-3 flex flex-wrap gap-1.5">{openResult.hotel.amenities.map((amenity) => <span key={amenity} className="rounded bg-surface-2 px-2 py-1 text-xs font-medium">{amenity}</span>)}</div></div><button className="btn btn-ghost" onClick={() => setEditing(!editing)}><Pencil className="size-4" /> Edit details</button></div>{editing ? <MetadataEditor hotel={openResult.hotel} source={source} onSaved={(hotel) => { onUpdateHotel(hotel); setEditing(false); }} /> : null}<div><h3 className="mb-3 font-bold">Matching rooms</h3><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-y border-line bg-surface-2 text-xs uppercase text-muted"><tr><th className="px-3 py-2">Room</th><th className="px-3 py-2">Meal / occupancy</th><th className="px-3 py-2">Basis</th><th className="px-3 py-2">Terms</th><th className="px-3 py-2 text-right">Net rate</th><th className="px-3 py-2 text-right">Client total</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-line">{openResult.rates.map((rate) => <RoomRow key={rate.id} hotel={openResult.hotel} rate={rate} selected={selected.some((item) => item.rate.id === rate.id)} preferred={isCustomerSelection(openResult.hotel, rate, preference)} onToggle={onToggle} />)}</tbody></table></div><div className="space-y-3 lg:hidden">{openResult.rates.map((rate) => <RoomCard key={rate.id} hotel={openResult.hotel} rate={rate} rooms={rooms} selected={selected.some((item) => item.rate.id === rate.id)} preferred={isCustomerSelection(openResult.hotel, rate, preference)} onToggle={onToggle} />)}</div></div><p className="border-l-2 border-warning bg-warning/5 px-3 py-2 text-xs text-warning">Rate matched; confirm availability. Supplier inventory is not live or guaranteed.</p></div></Modal>;
}

function RoomRow({ hotel, rate, selected, preferred, onToggle }: { hotel: HotelMetadata; rate: HotelRateOffer; selected: boolean; preferred: boolean; onToggle: (hotel: HotelMetadata, rate: HotelRateOffer) => void }) {
  return <tr className={preferred ? "bg-info/10" : undefined}><td className="px-3 py-3 align-top"><p className="font-bold">{rate.roomType}</p>{preferred ? <span className="badge badge-info mt-1">Customer selected</span> : <p className="mt-1 text-xs text-muted">{rate.rateType}</p>}</td><td className="px-3 py-3 align-top"><p>{rate.mealPlan}</p><p className="mt-1 text-xs text-muted">{rate.occupancy}</p></td><td className="px-3 py-3 align-top"><p>{rate.unitBasis}</p><p className="mt-1 text-xs text-muted">Tax {rate.taxIncluded.toLowerCase()} | Commission {rate.commissionIncluded.toLowerCase()}</p></td><td className="max-w-64 px-3 py-3 align-top"><p className="line-clamp-2 text-xs">{cancellationSummary(rate.cancellationPolicy)}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{rate.paymentTerms || "Payment terms not supplied"}</p></td><td className="tnum px-3 py-3 text-right align-top">{formatMoney(rate.netTotal, rate.currency)}</td><td className="tnum px-3 py-3 text-right align-top font-bold">{formatMoney(rate.clientTotal, rate.currency)}</td><td className="px-3 py-3 text-right align-top"><button className={selected ? "btn btn-ghost" : "btn btn-primary hover:btn-primary-hover"} onClick={() => onToggle(hotel, rate)} disabled={rate.requiresConfirmation}>{selected ? <><Check className="size-4" /> Selected</> : rate.requiresConfirmation ? "Confirm basis" : "Select"}</button></td></tr>;
}

function RoomCard({ hotel, rate, rooms, selected, preferred, onToggle }: { hotel: HotelMetadata; rate: HotelRateOffer; rooms: number; selected: boolean; preferred: boolean; onToggle: (hotel: HotelMetadata, rate: HotelRateOffer) => void }) {
  return <div className={`rounded-lg border p-4 ${preferred ? "border-info bg-info/10" : "border-line"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{rate.roomType}</p>{preferred ? <span className="badge badge-info mt-1">Customer selected</span> : null}<p className="text-sm text-muted">{rate.mealPlan} | {rate.occupancy}</p></div><p className="tnum text-right font-bold">{formatMoney(rate.clientTotal, rate.currency)}</p></div><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted">Rate basis</dt><dd>{rate.unitBasis}</dd></div><div><dt className="text-muted">Supplier rate</dt><dd className="tnum">{formatMoney(rate.netTotal, rate.currency)}</dd></div><div><dt className="text-muted">Tax</dt><dd>{rate.taxIncluded}</dd></div><div><dt className="text-muted">Pricing</dt><dd>{rate.pricingBasis === "rack" ? "Rack" : "Net"} + {HOTEL_MARKUP_PERCENT}%</dd></div></dl><p className="mt-3 text-xs">{cancellationSummary(rate.cancellationPolicy)}</p><p className="mt-1 text-xs text-muted">{rate.paymentTerms || "Payment terms not supplied"}</p><button className={selected ? "btn btn-ghost mt-4 w-full" : "btn btn-primary hover:btn-primary-hover mt-4 w-full"} onClick={() => onToggle(hotel, rate)} disabled={rate.requiresConfirmation}>{selected ? <><Check className="size-4" /> Selected</> : rate.requiresConfirmation ? "Confirm rate basis" : `Select for ${rooms} room${rooms === 1 ? "" : "s"}`}</button></div>;
}

function MetadataEditor({ hotel, source, onSaved }: { hotel: HotelMetadata; source: "live" | "demo"; onSaved: (hotel: HotelMetadata) => void }) {
  const [area, setArea] = useState(hotel.area ?? "");
  const [description, setDescription] = useState(hotel.shortDescription ?? "");
  const [images, setImages] = useState(hotel.imageUrls.join("\n"));
  const [amenities, setAmenities] = useState(hotel.amenities.join(", "));
  const [hotelGroup, setHotelGroup] = useState(hotel.hotelGroup ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(hotel.websiteUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true); setError(null);
    const next = { area: area.trim() || null, shortDescription: description.trim() || null, imageUrls: images.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), amenities: amenities.split(/,|\r?\n/).map((item) => item.trim()).filter(Boolean), hotelGroup: hotelGroup.trim() || null, websiteUrl: websiteUrl.trim() || null };
    try { const response = await fetch(`/api/hotels/${hotel.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Could not save hotel details."); onSaved({ ...hotel, ...next }); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save hotel details."); } finally { setSaving(false); }
  };
  return <div className="rounded-lg border border-line bg-surface-2 p-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Area"><input className="field" value={area} onChange={(event) => setArea(event.target.value)} /></Field><Field label="Hotel group"><input className="field" value={hotelGroup} onChange={(event) => setHotelGroup(event.target.value)} /></Field><Field label="Official website"><input className="field" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} /></Field><Field label="Amenities" hint="Separate with commas"><input className="field" value={amenities} onChange={(event) => setAmenities(event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Short description"><textarea className="field min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} /></Field></div><div className="sm:col-span-2"><Field label="Image URLs" hint="One URL or local path per line"><textarea className="field min-h-20" value={images} onChange={(event) => setImages(event.target.value)} /></Field></div></div>{error ? <p className="mt-3 text-sm text-error">{error}</p> : null}<div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted">{source === "demo" ? "Sample edits last for this session only." : "Updates the shared hotel rate record."}</p><button className="btn btn-primary hover:btn-primary-hover" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save details"}</button></div></div>;
}
