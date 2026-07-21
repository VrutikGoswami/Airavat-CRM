import {
  calculateHotelRate,
  cancellationIsFree,
  type HotelMetadata,
  type HotelRateOffer,
  type HotelSearchInput,
  type HotelSearchResponse,
} from "@/lib/hotels";

type DemoHotelTemplate = Omit<HotelMetadata, "destinationName" | "city" | "country"> & {
  roomRates: Array<{
    roomType: string;
    mealPlan: string;
    amount: number;
    unitBasis?: string;
    cancellation: string;
    paymentTerms: string;
  }>;
};

const coastHotels: DemoHotelTemplate[] = [
  {
    id: "demo-hotel-diani-reef",
    name: "Kijani Reef Resort",
    starRating: 4,
    area: "Diani Beach",
    shortDescription: "A relaxed beachfront resort with garden rooms and direct access to the Indian Ocean.",
    imageUrls: ["/images/hotels/diani-coast-demo.jpg", "/images/hotels/diani-pavilion-demo.jpg"],
    amenities: ["Beachfront", "Pool", "Wi-Fi", "Airport transfer"],
    roomRates: [
      { roomType: "Garden Room", mealPlan: "Half Board", amount: 18_500, cancellation: "Free cancellation until 14 days before arrival", paymentTerms: "30% deposit; balance 21 days before arrival" },
      { roomType: "Ocean View Room", mealPlan: "Full Board", amount: 24_500, cancellation: "50% charge within 14 days of arrival", paymentTerms: "Full payment 21 days before arrival" },
    ],
  },
  {
    id: "demo-hotel-diani-pavilion",
    name: "Bahari Palm Pavilion",
    starRating: 5,
    area: "Galu Beach",
    shortDescription: "A quiet oceanfront property with spacious rooms, shaded verandas and polished service.",
    imageUrls: ["/images/hotels/diani-pavilion-demo.jpg", "/images/hotels/diani-garden-demo.jpg"],
    amenities: ["Beachfront", "Pool", "Spa", "Restaurant", "Wi-Fi"],
    roomRates: [
      { roomType: "Deluxe Pavilion", mealPlan: "Half Board", amount: 31_000, cancellation: "Free cancellation until 21 days before arrival", paymentTerms: "30% deposit; balance 30 days before arrival" },
      { roomType: "Ocean Suite", mealPlan: "All Inclusive", amount: 43_000, cancellation: "Non-refundable within 30 days of arrival", paymentTerms: "Full payment 30 days before arrival" },
    ],
  },
  {
    id: "demo-hotel-diani-coral",
    name: "Coral Garden House",
    starRating: 3,
    area: "Central Diani",
    shortDescription: "A compact boutique stay set in tropical gardens, close to the beach and local restaurants.",
    imageUrls: ["/images/hotels/diani-garden-demo.jpg", "/images/hotels/diani-coast-demo.jpg"],
    amenities: ["Pool", "Wi-Fi", "Restaurant", "Family rooms"],
    roomRates: [
      { roomType: "Superior Double", mealPlan: "Bed & Breakfast", amount: 13_500, cancellation: "Free cancellation until 7 days before arrival", paymentTerms: "Pay 7 days before arrival" },
      { roomType: "Family Room", mealPlan: "Half Board", amount: 20_000, cancellation: "One night charge within 7 days of arrival", paymentTerms: "50% deposit" },
    ],
  },
];

const cityHotels: DemoHotelTemplate[] = [
  {
    id: "demo-hotel-city-central",
    name: "Acacia City Hotel",
    starRating: 4,
    area: "City Centre",
    shortDescription: "A practical full-service city hotel suited to business trips and short stopovers.",
    imageUrls: ["/images/hotels/nairobi-city-demo.jpg"],
    amenities: ["Wi-Fi", "Gym", "Restaurant", "Airport transfer"],
    roomRates: [
      { roomType: "Business King", mealPlan: "Bed & Breakfast", amount: 15_500, cancellation: "Free cancellation until 48 hours before arrival", paymentTerms: "Pay before arrival" },
      { roomType: "Executive Room", mealPlan: "Half Board", amount: 20_500, cancellation: "One night charge within 48 hours", paymentTerms: "Pay before arrival" },
    ],
  },
  {
    id: "demo-hotel-city-park",
    name: "Forest Park Suites",
    starRating: 5,
    area: "Business District",
    shortDescription: "A polished urban stay with larger rooms and facilities for longer business visits.",
    imageUrls: ["/images/hotels/nairobi-city-demo.jpg"],
    amenities: ["Wi-Fi", "Pool", "Gym", "Meeting rooms"],
    roomRates: [
      { roomType: "Studio Suite", mealPlan: "Bed & Breakfast", amount: 25_000, cancellation: "Free cancellation until 7 days before arrival", paymentTerms: "Card guarantee; pay on arrival" },
      { roomType: "One Bedroom Suite", mealPlan: "Room Only", amount: 29_000, cancellation: "Non-refundable", paymentTerms: "Full prepayment" },
    ],
  },
  {
    id: "demo-hotel-city-value",
    name: "Terracotta House",
    starRating: 3,
    area: "Westlands",
    shortDescription: "A straightforward boutique hotel with a calm courtyard and convenient city access.",
    imageUrls: ["/images/hotels/nairobi-city-demo.jpg"],
    amenities: ["Wi-Fi", "Restaurant", "Parking"],
    roomRates: [
      { roomType: "Standard Room", mealPlan: "Bed & Breakfast", amount: 11_500, cancellation: "Free cancellation until 72 hours before arrival", paymentTerms: "Pay before arrival" },
    ],
  },
];

const safariHotels: DemoHotelTemplate[] = [
  {
    id: "demo-hotel-mara-plains",
    name: "Mara Plains Camp",
    starRating: 5,
    area: "Maasai Mara",
    shortDescription: "A small tented camp overlooking open savannah, with meals and shared game activities included.",
    imageUrls: ["/images/hotels/mara-lodge-demo.jpg"],
    amenities: ["Game drives", "Full board", "Wi-Fi", "Airstrip transfer"],
    roomRates: [
      { roomType: "Savannah Tent", mealPlan: "Full Board", amount: 34_000, unitBasis: "Per Person Sharing Per Night", cancellation: "Free cancellation until 45 days before arrival", paymentTerms: "30% deposit; balance 45 days before arrival" },
      { roomType: "Family Tent", mealPlan: "Full Board", amount: 148_000, unitBasis: "Per Room Per Night", cancellation: "Non-refundable within 45 days", paymentTerms: "Full payment 45 days before arrival" },
    ],
  },
  {
    id: "demo-hotel-mara-ridge",
    name: "Enkare Ridge Lodge",
    starRating: 4,
    area: "Talek",
    shortDescription: "A comfortable safari lodge with broad views and easy access to the reserve gates.",
    imageUrls: ["/images/hotels/mara-lodge-demo.jpg"],
    amenities: ["Pool", "Full board", "Game drives", "Family rooms"],
    roomRates: [
      { roomType: "Lodge Room", mealPlan: "Full Board", amount: 27_500, unitBasis: "Per Person Sharing Per Night", cancellation: "Free cancellation until 30 days before arrival", paymentTerms: "50% deposit; balance 30 days before arrival" },
    ],
  },
  {
    id: "demo-hotel-mara-value",
    name: "Olare Safari House",
    starRating: 3,
    area: "Sekenani",
    shortDescription: "A simple, friendly safari base with full-board meals and practical family accommodation.",
    imageUrls: ["/images/hotels/mara-lodge-demo.jpg"],
    amenities: ["Full board", "Parking", "Family rooms"],
    roomRates: [
      { roomType: "Safari Chalet", mealPlan: "Full Board", amount: 19_500, unitBasis: "Per Person Sharing Per Night", cancellation: "One night charge within 14 days", paymentTerms: "50% deposit" },
    ],
  },
];

function templatesFor(destination: string): DemoHotelTemplate[] {
  const normalized = destination.toLowerCase();
  if (["mara", "safari", "amboseli", "tsavo"].some((word) => normalized.includes(word))) return safariHotels;
  if (["diani", "mombasa", "watamu", "malindi", "coast", "beach"].some((word) => normalized.includes(word))) return coastHotels;
  return cityHotels;
}

export function createDemoHotelSearch(input: HotelSearchInput): HotelSearchResponse {
  const nights = Math.max(1, Math.round((Date.parse(input.checkOut) - Date.parse(input.checkIn)) / 86_400_000));
  const destination = input.destination.trim();
  const ratesFor = (template: DemoHotelTemplate): HotelRateOffer[] => template.roomRates
    .filter((rate) => input.mealPlan === "Any" || rate.mealPlan.toLowerCase() === input.mealPlan.toLowerCase())
    .map((rate, index) => {
      const unitBasis = rate.unitBasis ?? "Per Room Per Night";
      const totals = calculateHotelRate({
        amount: rate.amount,
        unitBasis,
        nights,
        rooms: input.rooms,
        adults: input.adults,
        children: input.children,
      });
      return {
        id: `${template.id}-rate-${index + 1}`,
        hotelId: template.id,
        documentId: "demo-rate-document",
        supplierName: "Airavat sample supplier",
        roomType: rate.roomType,
        mealPlan: rate.mealPlan,
        occupancy: "Up to 2 adults and 1 child per room",
        rateType: "Contract",
        validFrom: input.checkIn,
        validTo: input.checkOut,
        bookingBy: null,
        amount: rate.amount,
        currency: "KES",
        market: input.market || "Resident",
        unitBasis,
        minimumStay: null,
        taxIncluded: "Yes",
        commissionIncluded: "No",
        cancellationPolicy: rate.cancellation,
        paymentTerms: rate.paymentTerms,
        conditions: "Sample rate for workflow testing only.",
        ...totals,
        freeCancellation: cancellationIsFree(rate.cancellation),
      };
    });

  return {
    source: "demo",
    notice: "Sample hotel rates for workflow testing. They are not live supplier offers.",
    nights,
    results: templatesFor(destination).map((template) => ({
      hotel: {
        id: template.id,
        name: template.name,
        destinationName: destination,
        city: destination,
        country: "Kenya",
        starRating: template.starRating,
        area: template.area,
        shortDescription: template.shortDescription,
        imageUrls: template.imageUrls,
        amenities: template.amenities,
      },
      rates: ratesFor(template),
    })).filter((result) => result.rates.length > 0),
  };
}
