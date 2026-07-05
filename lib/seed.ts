import { dateFromToday, dateTimeFromToday } from "@/lib/format";
import { rateForCurrency } from "@/lib/fx";
import type {
  Activity,
  Booking,
  Conversation,
  Customer,
  DocumentRecord,
  Enquiry,
  Message,
  Payment,
  Quotation,
  QuotationItem,
  QuotationOption,
  Supplier,
  Task,
  User,
} from "@/lib/types";

/**
 * Realistic but entirely fictional demonstration data. All names, numbers,
 * companies and references are invented for the demo. Dates are anchored to
 * the reference "today" so the dashboard shows stable overdue/today states.
 */
export type SeedData = {
  users: User[];
  customers: Customer[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  quotationOptions: QuotationOption[];
  quotationItems: QuotationItem[];
  suppliers: Supplier[];
  bookings: Booking[];
  payments: Payment[];
  tasks: Task[];
  conversations: Conversation[];
  messages: Message[];
  documents: DocumentRecord[];
  activities: Activity[];
};

export function createSeedData(): SeedData {
  const users: User[] = [
    { id: "u-amina", name: "Amina Wanjiru", email: "amina@airavat.example", role: "admin", initials: "AW", active: true },
    { id: "u-daniel", name: "Daniel Otieno", email: "daniel@airavat.example", role: "consultant", initials: "DO", active: true },
    { id: "u-grace", name: "Grace Mwangi", email: "grace@airavat.example", role: "consultant", initials: "GM", active: true },
  ];

  const customers: Customer[] = [
    { id: "c-muller", name: "Lukas Müller", whatsapp: "+49 151 2345678", email: "lukas.muller@example.de", type: "individual", assignedConsultantId: "u-grace", preferredContact: "whatsapp", preferences: "Keen photographer, prefers fly-in over long drives, quieter conservancies.", previousDestinations: [], company: undefined, createdAt: dateFromToday(-14) },
    { id: "c-savannah", name: "Savannah Freight Ltd", whatsapp: "+254 722 100200", email: "travel@savannahfreight.example", type: "corporate", assignedConsultantId: "u-grace", preferredContact: "email", preferences: "Business class where budget allows; needs consolidated monthly invoicing.", previousDestinations: ["Dubai", "Guangzhou"], company: "Savannah Freight Ltd", createdAt: dateFromToday(-120) },
    { id: "c-kimani", name: "Peter Kimani", whatsapp: "+254 733 445566", email: "pkimani@example.com", type: "family", assignedConsultantId: "u-grace", preferredContact: "whatsapp", preferences: "Travelling with two children (7, 10). Wants family rooms and short drives.", previousDestinations: ["Naivasha"], createdAt: dateFromToday(-40) },
    { id: "c-njoroge", name: "James Njoroge", whatsapp: "+254 712 345001", email: "james.njoroge@example.com", type: "individual", assignedConsultantId: "u-daniel", preferredContact: "phone", preferences: "Flexible on airline, values shortest total travel time.", previousDestinations: ["London", "Dubai"], createdAt: dateFromToday(-3) },
    { id: "c-achieng", name: "Brenda Achieng", whatsapp: "+254 720 998877", email: "brenda.achieng@example.com", type: "individual", assignedConsultantId: "u-daniel", preferredContact: "whatsapp", preferences: "Beach break, mid-range budget, half board preferred.", previousDestinations: [], createdAt: dateFromToday(-9) },
    { id: "c-thompson", name: "Sarah Thompson", whatsapp: "+44 7700 900123", email: "sarah.thompson@example.co.uk", type: "individual", assignedConsultantId: "u-daniel", preferredContact: "email", preferences: "Honeymoon — safari then coast. Premium camps, romantic touches welcome.", previousDestinations: [], createdAt: dateFromToday(-30) },
    { id: "c-riverside", name: "Riverside Academy", whatsapp: "+254 711 223344", email: "trips@riversideacademy.example", type: "group", assignedConsultantId: "u-grace", preferredContact: "email", preferences: "Year-10 geography trip, 32 students + 4 staff. Safety and budget critical.", previousDestinations: ["Naivasha"], company: "Riverside Academy", createdAt: dateFromToday(-55) },
    { id: "c-devos", name: "Emma De Vos", whatsapp: "+32 470 12 34 56", email: "emma.devos@example.be", type: "family", assignedConsultantId: "u-grace", preferredContact: "whatsapp", preferences: "Family of four, first safari. Wants a gentle pace and family-friendly camp.", previousDestinations: [], createdAt: dateFromToday(-75) },
    { id: "c-omar", name: "Fatuma Omar", whatsapp: "+254 723 556677", email: "fatuma.omar@example.com", type: "individual", assignedConsultantId: "u-daniel", preferredContact: "whatsapp", preferences: "Regular airport transfers for visiting family; reliability over price.", previousDestinations: ["Mombasa"], createdAt: dateFromToday(-60) },
    { id: "c-cheruiyot", name: "Mercy Cheruiyot", whatsapp: "+254 701 334455", email: "mercy.cheruiyot@example.com", type: "family", assignedConsultantId: "u-daniel", preferredContact: "whatsapp", preferences: "School-holiday coast trip with extended family; needs connecting rooms.", previousDestinations: ["Diani"], createdAt: dateFromToday(-6) },
  ];

  // --- Enquiries: one per visible pipeline stage --------------------------
  const enquiries: Enquiry[] = [
    {
      id: "e-njoroge", ref: "ENQ-3F7K2", customerId: "c-njoroge", service: "flights",
      origin: "Nairobi (NBO)", destination: "London (LHR)", travelStartDate: dateFromToday(48), travelEndDate: dateFromToday(62),
      datesFlexible: true, travellers: { adults: 1, children: 0, infants: 0 }, budget: "KES 120,000 – 160,000",
      requirements: "Return economy, ideally one stop or direct. Prefers evening departure from Nairobi.",
      leadSource: "website", assignedConsultantId: "u-daniel", stage: "new", waitingOn: "team",
      nextActionLabel: "Send initial fare options", nextActionDate: dateFromToday(0), estimatedValue: 145000,
      status: "open", internalNotes: [], createdAt: dateTimeFromToday(-1, 16, 20), updatedAt: dateTimeFromToday(-1, 16, 20),
    },
    {
      id: "e-achieng", ref: "ENQ-8M1QP", customerId: "c-achieng", service: "hotel",
      origin: "Nairobi", destination: "Diani Beach", travelStartDate: dateFromToday(35), travelEndDate: dateFromToday(40),
      datesFlexible: false, travellers: { adults: 2, children: 0, infants: 0 }, budget: "KES 80,000 – 110,000",
      requirements: "5 nights, half board, sea-facing room if possible. Needs to know transfer options too.",
      leadSource: "whatsapp", assignedConsultantId: "u-daniel", stage: "details-needed", waitingOn: "customer",
      nextActionLabel: "Awaiting confirmed dates from customer", nextActionDate: dateFromToday(1), estimatedValue: 96000,
      status: "open",
      internalNotes: [{ id: "n-ach1", body: "Asked whether the second week of the month works — waiting to hear back.", authorId: "u-daniel", at: dateTimeFromToday(-2, 11, 5) }],
      createdAt: dateTimeFromToday(-4, 9, 30), updatedAt: dateTimeFromToday(-2, 11, 5),
    },
    {
      id: "e-family", ref: "ENQ-5T9RW", customerId: "c-kimani", service: "holiday-package",
      origin: "Nairobi", destination: "Nairobi · Maasai Mara · Diani", travelStartDate: dateFromToday(70), travelEndDate: dateFromToday(78),
      datesFlexible: true, travellers: { adults: 2, children: 2, infants: 0 }, budget: "KES 450,000 – 600,000",
      requirements: "Family holiday over the August break: a couple of nights in Nairobi, safari, then the coast. Short driving days.",
      leadSource: "referral", assignedConsultantId: "u-grace", stage: "quotation-in-progress", waitingOn: "team",
      nextActionLabel: "Finish drafting package quotation", nextActionDate: dateFromToday(0), estimatedValue: 540000,
      status: "open",
      internalNotes: [{ id: "n-fam1", body: "Referred by the Cheruiyot family. Building fly-in vs road options.", authorId: "u-grace", at: dateTimeFromToday(-1, 14, 0) }],
      createdAt: dateTimeFromToday(-3, 10, 15), updatedAt: dateTimeFromToday(-1, 14, 0),
    },
    {
      id: "e-corp", ref: "ENQ-2K6HD", customerId: "c-savannah", service: "corporate",
      origin: "Nairobi (NBO)", destination: "Dubai (DXB)", travelStartDate: dateFromToday(21), travelEndDate: dateFromToday(26),
      datesFlexible: false, travellers: { adults: 3, children: 0, infants: 0 }, budget: "USD 4,500 – 6,000",
      requirements: "Three staff to a trade expo. Business class preferred, all on one booking, invoice to accounts.",
      leadSource: "email", assignedConsultantId: "u-grace", stage: "quotation-sent", waitingOn: "customer",
      nextActionLabel: "Follow up on sent quotation", nextActionDate: dateFromToday(0), estimatedValue: 720000,
      status: "open",
      internalNotes: [{ id: "n-corp1", body: "Sent two-airline comparison. Finance usually approves within a few days.", authorId: "u-grace", at: dateTimeFromToday(-2, 9, 0) }],
      createdAt: dateTimeFromToday(-6, 8, 45), updatedAt: dateTimeFromToday(-2, 9, 0),
    },
    {
      id: "e-mara", ref: "ENQ-9C4NB", customerId: "c-muller", service: "safari",
      origin: "Nairobi (Wilson)", destination: "Maasai Mara", travelStartDate: dateFromToday(33), travelEndDate: dateFromToday(37),
      datesFlexible: false, travellers: { adults: 2, children: 0, infants: 0 }, budget: "USD 3,000 – 4,500",
      requirements: "Fly-in migration-season safari, 4 nights, a conservancy for lower vehicle density. Photography focus.",
      leadSource: "website", assignedConsultantId: "u-grace", stage: "awaiting-customer", waitingOn: "customer",
      nextActionLabel: "Chase decision on the three options", nextActionDate: dateFromToday(0), estimatedValue: 480000,
      status: "open",
      internalNotes: [{ id: "n-mara1", body: "Sent road / fly-in / premium options. Leaning to fly-in; checking camp availability.", authorId: "u-grace", at: dateTimeFromToday(-1, 12, 30) }],
      createdAt: dateTimeFromToday(-8, 7, 50), updatedAt: dateTimeFromToday(-1, 12, 30),
    },
    {
      id: "e-thompson", ref: "ENQ-7H2LM", customerId: "c-thompson", service: "holiday-package",
      origin: "London (LHR)", destination: "Maasai Mara · Diani", travelStartDate: dateFromToday(54), travelEndDate: dateFromToday(66),
      datesFlexible: false, travellers: { adults: 2, children: 0, infants: 0 }, budget: "GBP 6,000 – 8,000",
      requirements: "Honeymoon: premium safari camp then a beach resort. Accepted the quotation, deposit to follow.",
      leadSource: "referral", assignedConsultantId: "u-daniel", stage: "payment-pending", waitingOn: "customer",
      nextActionLabel: "Collect 30% deposit to hold camps", nextActionDate: dateFromToday(-1), estimatedValue: 1120000,
      status: "open",
      internalNotes: [{ id: "n-thom1", body: "Quotation accepted by email. Camps held provisionally for 5 days — deposit needed to confirm.", authorId: "u-daniel", at: dateTimeFromToday(-3, 15, 10) }],
      createdAt: dateTimeFromToday(-20, 10, 0), updatedAt: dateTimeFromToday(-3, 15, 10),
    },
    {
      id: "e-riverside", ref: "ENQ-1B8VC", customerId: "c-riverside", service: "group",
      origin: "Nairobi", destination: "Lake Naivasha · Hell's Gate", travelStartDate: dateFromToday(28), travelEndDate: dateFromToday(31),
      datesFlexible: false, travellers: { adults: 4, children: 32, infants: 0 }, budget: "KES 1,200,000",
      requirements: "School geography trip, 32 students + 4 staff. Coach transport, full board, strict safety requirements.",
      leadSource: "phone", assignedConsultantId: "u-grace", stage: "booking-in-progress", waitingOn: "supplier",
      nextActionLabel: "Confirm coach operator and room block", nextActionDate: dateFromToday(2), estimatedValue: 1200000,
      status: "open",
      internalNotes: [{ id: "n-riv1", body: "Deposit received. Awaiting written confirmation from the lodge on the group rate.", authorId: "u-grace", at: dateTimeFromToday(-1, 9, 40) }],
      createdAt: dateTimeFromToday(-18, 13, 0), updatedAt: dateTimeFromToday(-1, 9, 40),
    },
    {
      id: "e-devos", ref: "ENQ-6D3PA", customerId: "c-devos", service: "holiday-package",
      origin: "Brussels (BRU)", destination: "Nairobi · Maasai Mara", travelStartDate: dateFromToday(40), travelEndDate: dateFromToday(48),
      datesFlexible: false, travellers: { adults: 2, children: 2, infants: 0 }, budget: "EUR 7,000",
      requirements: "First family safari, gentle pace, family-friendly camp. Confirmed and booked.",
      leadSource: "website", assignedConsultantId: "u-grace", stage: "confirmed", waitingOn: "none",
      nextActionLabel: "Send final documents 2 weeks before travel", nextActionDate: dateFromToday(5), estimatedValue: 910000,
      status: "open",
      internalNotes: [{ id: "n-dev1", body: "Booking confirmed with camp and flights. Balance due 3 weeks before travel.", authorId: "u-grace", at: dateTimeFromToday(-5, 11, 0) }],
      createdAt: dateTimeFromToday(-30, 9, 0), updatedAt: dateTimeFromToday(-5, 11, 0),
    },
  ];

  // --- Quotations (3) with options + items --------------------------------
  const quotations: Quotation[] = [
    {
      id: "q-mara", ref: "QUO-1042", customerId: "c-muller", enquiryId: "e-mara",
      destination: "Maasai Mara", travelStartDate: dateFromToday(33), travelEndDate: dateFromToday(37),
      travellers: { adults: 2, children: 0, infants: 0 }, currency: "USD", validUntil: dateFromToday(9),
      status: "viewed", createdById: "u-grace", createdAt: dateTimeFromToday(-4, 16, 0), sentAt: dateTimeFromToday(-4, 17, 30), viewedAt: dateTimeFromToday(-3, 8, 15),
      depositPct: 30, exchangeRateToKes: rateForCurrency("USD"), exclusions: ["International flights", "Travel insurance", "Items of a personal nature"],
      terms: "Prices are per person sharing and subject to availability at time of booking. A 30% deposit confirms the booking; balance due 30 days before travel.",
      selectedOptionLabel: undefined, shareToken: "mara-9c4nb-demo",
    },
    {
      id: "q-corp", ref: "QUO-1043", customerId: "c-savannah", enquiryId: "e-corp",
      destination: "Dubai", travelStartDate: dateFromToday(21), travelEndDate: dateFromToday(26),
      travellers: { adults: 3, children: 0, infants: 0 }, currency: "USD", validUntil: dateFromToday(4),
      status: "sent", createdById: "u-grace", createdAt: dateTimeFromToday(-2, 10, 0), sentAt: dateTimeFromToday(-2, 11, 0),
      depositPct: 100, exchangeRateToKes: rateForCurrency("USD"), exclusions: ["Airport transfers in Dubai", "Excess baggage", "Visa fees"],
      terms: "Fares are not guaranteed until ticketed. Full payment required to issue tickets. Airline change and cancellation rules apply per fare.",
      shareToken: "corp-2k6hd-demo",
    },
    {
      id: "q-devos", ref: "QUO-1039", customerId: "c-devos", enquiryId: "e-devos",
      destination: "Nairobi · Maasai Mara", travelStartDate: dateFromToday(40), travelEndDate: dateFromToday(48),
      travellers: { adults: 2, children: 2, infants: 0 }, currency: "EUR", validUntil: dateFromToday(-5),
      status: "accepted", createdById: "u-grace", createdAt: dateTimeFromToday(-12, 10, 0), sentAt: dateTimeFromToday(-12, 12, 0), viewedAt: dateTimeFromToday(-11, 9, 0),
      depositPct: 30, exchangeRateToKes: rateForCurrency("EUR"), exclusions: ["International flights", "Travel insurance", "Tips"],
      terms: "A 30% deposit confirms the booking; balance due 21 days before travel. Family camp held on confirmation.",
      selectedOptionLabel: "B", shareToken: "devos-6d3pa-demo",
    },
  ];

  const quotationOptions: QuotationOption[] = [
    { id: "qo-mara-a", quotationId: "q-mara", label: "A", name: "Road safari · mid-range camp", note: "Best value; a scenic but long drive each way." },
    { id: "qo-mara-b", quotationId: "q-mara", label: "B", name: "Fly-in · conservancy camp", note: "More time on game drives, quieter conservancy.", recommended: true },
    { id: "qo-mara-c", quotationId: "q-mara", label: "C", name: "Fly-in · premium tented camp", note: "Small premium camp, private vehicle." },
    { id: "qo-corp-a", quotationId: "q-corp", label: "A", name: "Kenya Airways — direct", note: "Direct both ways, convenient timings.", recommended: true },
    { id: "qo-corp-b", quotationId: "q-corp", label: "B", name: "Emirates — one stop", note: "Slightly cheaper, one stop, more baggage." },
    { id: "qo-devos-a", quotationId: "q-devos", label: "A", name: "Road safari · family lodge", note: "Budget-friendly, larger lodge." },
    { id: "qo-devos-b", quotationId: "q-devos", label: "B", name: "Fly-in · family camp", note: "Chosen option — gentle pace, family tents.", recommended: true },
  ];

  const suppliers: Supplier[] = [
    { id: "sup-safarilink", name: "Safarilink", type: "airline", contact: "res@safarilink.example · +254 20 600 0000", netRateNote: "Net scheduled light-aircraft fares, Wilson ⇄ Mara.", standardCancellation: "Non-refundable within 7 days of travel." },
    { id: "sup-olarro", name: "Olarro Conservancy Camp", type: "camp", contact: "reservations@olarro.example", netRateNote: "Net full-board conservancy rates incl. game drives.", standardCancellation: "50% charge within 30 days; 100% within 14 days." },
    { id: "sup-marasimba", name: "Mara Simba Family Camp", type: "camp", contact: "book@marasimba.example", netRateNote: "Net family-tent full-board rates.", standardCancellation: "50% charge within 30 days of travel." },
    { id: "sup-serena", name: "Nairobi Serena", type: "hotel", contact: "reservations@serena.example", netRateNote: "Contracted B&B city rates.", standardCancellation: "Free until 48h before arrival." },
    { id: "sup-kenya-airways", name: "Kenya Airways", type: "airline", contact: "via Amadeus / trade desk", netRateNote: "Published & negotiated corporate fares.", standardCancellation: "Airline fare rules apply per fare basis." },
    { id: "sup-airavat", name: "Airavat (in-house)", type: "in-house", contact: "operations desk", netRateNote: "Own transfers, coordination and service fees.", standardCancellation: "Free until 24h before service." },
  ];

  const quotationItems: QuotationItem[] = [
    // q-mara option B (representative)
    { id: "qi-1", optionId: "qo-mara-b", type: "flight", supplier: "Safarilink", supplierId: "sup-safarilink", description: "Wilson ⇄ Mara scheduled light aircraft, return", quantity: 2, costPrice: 320, markupPct: 12, sellingPrice: 358, taxPct: 0, notes: "Per person return", cancellation: "Non-refundable within 7 days" },
    { id: "qi-2", optionId: "qo-mara-b", type: "hotel", supplier: "Olarro Conservancy Camp", supplierId: "sup-olarro", description: "4 nights full board, incl. game drives & conservancy fees", startDate: dateFromToday(33), endDate: dateFromToday(37), quantity: 2, costPrice: 1180, markupPct: 15, sellingPrice: 1357, taxPct: 0, notes: "Per person sharing", cancellation: "50% within 30 days" },
    { id: "qi-3", optionId: "qo-mara-b", type: "transfer", supplier: "Airavat", description: "Nairobi hotel ⇄ Wilson Airport transfers", quantity: 2, costPrice: 45, markupPct: 20, sellingPrice: 54, taxPct: 0, cancellation: "Free until 24h before" },
    { id: "qi-4", optionId: "qo-mara-b", type: "service-fee", supplier: "Airavat", description: "Planning & coordination fee", quantity: 1, costPrice: 0, markupPct: 0, sellingPrice: 60, taxPct: 0 },
    // q-corp option A (representative)
    { id: "qi-5", optionId: "qo-corp-a", type: "flight", supplier: "Kenya Airways", description: "NBO ⇄ DXB business class, direct", startDate: dateFromToday(21), endDate: dateFromToday(26), quantity: 3, costPrice: 1650, markupPct: 6, sellingPrice: 1749, taxPct: 0, notes: "Per passenger, incl. taxes", cancellation: "Airline fare rules apply" },
    { id: "qi-6", optionId: "qo-corp-a", type: "service-fee", supplier: "Airavat", description: "Corporate ticketing fee (3 pax)", quantity: 3, costPrice: 0, markupPct: 0, sellingPrice: 25, taxPct: 0 },
    // q-devos option B (chosen) — priced to the booking
    { id: "qi-7", optionId: "qo-devos-b", type: "flight", supplier: "Safarilink", description: "Wilson ⇄ Mara light aircraft, family of four", quantity: 4, costPrice: 310, markupPct: 12, sellingPrice: 347, taxPct: 0 },
    { id: "qi-8", optionId: "qo-devos-b", type: "hotel", supplier: "Mara Simba Family Camp", description: "3 nights full board, family tents, game drives", startDate: dateFromToday(43), endDate: dateFromToday(46), quantity: 4, costPrice: 720, markupPct: 15, sellingPrice: 828, taxPct: 0 },
    { id: "qi-9", optionId: "qo-devos-b", type: "hotel", supplier: "Nairobi Serena", description: "2 nights B&B, family room, Nairobi", startDate: dateFromToday(40), endDate: dateFromToday(42), quantity: 2, costPrice: 190, markupPct: 18, sellingPrice: 224, taxPct: 0, notes: "Per room per night" },
    { id: "qi-10", optionId: "qo-devos-b", type: "transfer", supplier: "Airavat", description: "All airport & city transfers", quantity: 4, costPrice: 60, markupPct: 20, sellingPrice: 72, taxPct: 0 },
  ];

  // --- Bookings (2) + payments --------------------------------------------
  const bookings: Booking[] = [
    {
      id: "b-devos", ref: "BKG-508", customerId: "c-devos", quotationId: "q-devos", enquiryId: "e-devos",
      destination: "Nairobi · Maasai Mara", travelStartDate: dateFromToday(40), travelEndDate: dateFromToday(48),
      travellers: { adults: 2, children: 2, infants: 0 },
      servicesSummary: ["2 nights Nairobi (family room)", "3 nights Mara family camp", "Return light aircraft", "All transfers"],
      amadeusPnr: "KQ7X2M", hotelRefs: "MSC-22841 / SER-55190", transportRef: "AV-TRF-3391",
      totalSelling: 910000, totalCost: 726000, amountPaid: 273000, status: "fully-confirmed", assignedConsultantId: "u-grace", createdAt: dateTimeFromToday(-11, 10, 30),
    },
    {
      id: "b-riverside", ref: "BKG-511", customerId: "c-riverside", quotationId: undefined, enquiryId: "e-riverside",
      destination: "Lake Naivasha · Hell's Gate", travelStartDate: dateFromToday(28), travelEndDate: dateFromToday(31),
      travellers: { adults: 4, children: 32, infants: 0 },
      servicesSummary: ["Return coach transport", "3 nights full board (group block)", "Hell's Gate excursion & guides"],
      amadeusPnr: undefined, hotelRefs: "LNL-GRP-1180 (pending)", transportRef: "COACH-OP-77 (pending)",
      totalSelling: 1200000, totalCost: 990000, amountPaid: 360000, status: "partially-confirmed", assignedConsultantId: "u-grace", createdAt: dateTimeFromToday(-6, 14, 0),
    },
  ];

  const payments: Payment[] = [
    { id: "p-1", bookingId: "b-devos", amount: 273000, method: "bank-transfer", reference: "TRF-DEVOS-01", receivedAt: dateTimeFromToday(-11, 12, 0), recordedById: "u-grace" },
    { id: "p-2", bookingId: "b-riverside", amount: 360000, method: "mpesa", reference: "MPESA-RA-4471", receivedAt: dateTimeFromToday(-6, 15, 30), recordedById: "u-grace" },
  ];

  // --- Tasks (some due today / overdue for the dashboard) -----------------
  const tasks: Task[] = [
    { id: "t-1", title: "Call Lukas about the fly-in option", type: "follow-up-call", customerId: "c-muller", enquiryId: "e-mara", assignedToId: "u-grace", dueAt: dateTimeFromToday(0, 11, 0), priority: "high", done: false, createdAt: dateTimeFromToday(-1, 12, 30) },
    { id: "t-2", title: "Finish and send Kimani family package", type: "send-quotation", customerId: "c-kimani", enquiryId: "e-family", assignedToId: "u-grace", dueAt: dateTimeFromToday(0, 15, 0), priority: "medium", done: false, createdAt: dateTimeFromToday(-1, 14, 0) },
    { id: "t-3", title: "Chase honeymoon deposit (camps on hold)", type: "collect-payment", customerId: "c-thompson", enquiryId: "e-thompson", assignedToId: "u-daniel", dueAt: dateTimeFromToday(-1, 10, 0), priority: "high", done: false, createdAt: dateTimeFromToday(-3, 15, 10) },
    { id: "t-4", title: "Confirm coach operator for Riverside trip", type: "confirm-supplier", customerId: "c-riverside", enquiryId: "e-riverside", bookingId: "b-riverside", assignedToId: "u-grace", dueAt: dateTimeFromToday(2, 9, 0), priority: "high", done: false, createdAt: dateTimeFromToday(-1, 9, 40) },
    { id: "t-5", title: "Follow up Savannah Freight quotation", type: "follow-up-call", customerId: "c-savannah", enquiryId: "e-corp", assignedToId: "u-grace", dueAt: dateTimeFromToday(0, 9, 30), priority: "medium", done: false, createdAt: dateTimeFromToday(-2, 9, 0) },
    { id: "t-6", title: "Prepare final documents for De Vos family", type: "send-documents", customerId: "c-devos", bookingId: "b-devos", assignedToId: "u-grace", dueAt: dateTimeFromToday(5, 12, 0), priority: "low", done: false, createdAt: dateTimeFromToday(-5, 11, 0) },
    { id: "t-7", title: "Send fare options to James Njoroge", type: "send-quotation", customerId: "c-njoroge", enquiryId: "e-njoroge", assignedToId: "u-daniel", dueAt: dateTimeFromToday(0, 14, 0), priority: "medium", done: false, createdAt: dateTimeFromToday(-1, 16, 20) },
    { id: "t-8", title: "Reconcile M-Pesa payments for the week", type: "general", assignedToId: "u-daniel", dueAt: dateTimeFromToday(-1, 17, 0), priority: "low", done: false, createdAt: dateTimeFromToday(-2, 17, 0) },
    { id: "t-9", title: "Send Diani hotel shortlist to Brenda", type: "send-quotation", customerId: "c-achieng", enquiryId: "e-achieng", assignedToId: "u-daniel", dueAt: dateTimeFromToday(1, 10, 0), priority: "medium", done: false, createdAt: dateTimeFromToday(-2, 11, 5) },
  ];

  // --- WhatsApp conversations + messages ----------------------------------
  const conversations: Conversation[] = [
    { id: "cv-muller", customerId: "c-muller", phone: "+49 151 2345678", displayName: "Lukas Müller", assignedConsultantId: "u-grace", enquiryId: "e-mara", unreadCount: 2, lastMessageAt: dateTimeFromToday(0, 8, 10), windowExpiresAt: dateTimeFromToday(1, 8, 10) },
    { id: "cv-kimani", customerId: "c-kimani", phone: "+254 733 445566", displayName: "Peter Kimani", assignedConsultantId: "u-grace", enquiryId: "e-family", unreadCount: 0, lastMessageAt: dateTimeFromToday(-1, 14, 5), windowExpiresAt: dateTimeFromToday(0, 14, 5) },
    { id: "cv-thompson", customerId: "c-thompson", phone: "+44 7700 900123", displayName: "Sarah Thompson", assignedConsultantId: "u-daniel", enquiryId: "e-thompson", unreadCount: 1, lastMessageAt: dateTimeFromToday(0, 7, 40), windowExpiresAt: dateTimeFromToday(1, 7, 40) },
    { id: "cv-new", customerId: undefined, phone: "+254 733 999888", displayName: "+254 733 999888", assignedConsultantId: undefined, enquiryId: undefined, unreadCount: 1, lastMessageAt: dateTimeFromToday(0, 9, 20), windowExpiresAt: dateTimeFromToday(1, 9, 20) },
  ];

  const messages: Message[] = [
    // Müller
    { id: "m-1", conversationId: "cv-muller", direction: "out", body: "Hi Lukas, I've sent three options for your Mara safari — road, fly-in, and a premium fly-in. Happy to talk them through.", at: dateTimeFromToday(-1, 12, 35), status: "read", authorId: "u-grace" },
    { id: "m-2", conversationId: "cv-muller", direction: "in", body: "Thanks Grace! The fly-in conservancy option looks great.", at: dateTimeFromToday(0, 8, 5), status: "received" },
    { id: "m-3", conversationId: "cv-muller", direction: "in", body: "Is it possible to add one extra night?", at: dateTimeFromToday(0, 8, 10), status: "received" },
    // Kimani
    { id: "m-4", conversationId: "cv-kimani", direction: "in", body: "Hi, any update on the family package? Excited to see it 😊", at: dateTimeFromToday(-1, 14, 5), status: "received" },
    { id: "m-5", conversationId: "cv-kimani", direction: "out", body: "Almost ready Peter — you'll have it today with a road and a fly-in option.", at: dateTimeFromToday(-1, 14, 20), status: "delivered", authorId: "u-grace" },
    // Thompson
    { id: "m-6", conversationId: "cv-thompson", direction: "out", body: "Wonderful news on accepting the quote! To hold the camps I'll need the 30% deposit — shall I send the details?", at: dateTimeFromToday(-1, 16, 0), status: "read", authorId: "u-daniel" },
    { id: "m-7", conversationId: "cv-thompson", direction: "in", body: "Yes please send them, we'll pay this week.", at: dateTimeFromToday(0, 7, 40), status: "received" },
    // New number
    { id: "m-8", conversationId: "cv-new", direction: "in", body: "Hello, I got your number from a friend. Do you arrange trips to Zanzibar?", at: dateTimeFromToday(0, 9, 20), status: "received" },
  ];

  // --- Documents -----------------------------------------------------------
  const documents: DocumentRecord[] = [
    { id: "d-1", name: "QUO-1039 — De Vos family.pdf", kind: "quotation", customerId: "c-devos", bookingId: "b-devos", uploadedById: "u-grace", uploadedAt: dateTimeFromToday(-12, 12, 0) },
    { id: "d-2", name: "BKG-508 — Invoice.pdf", kind: "invoice", customerId: "c-devos", bookingId: "b-devos", uploadedById: "u-grace", uploadedAt: dateTimeFromToday(-11, 10, 45) },
    { id: "d-3", name: "Riverside — deposit receipt.pdf", kind: "invoice", customerId: "c-riverside", bookingId: "b-riverside", uploadedById: "u-grace", uploadedAt: dateTimeFromToday(-6, 15, 35) },
  ];

  // --- Activity timeline ---------------------------------------------------
  const activities: Activity[] = [
    { id: "a-1", kind: "website-form", summary: "Enquiry received from the website", at: dateTimeFromToday(-8, 7, 50), customerId: "c-muller", enquiryId: "e-mara", actorId: undefined },
    { id: "a-2", kind: "quotation-created", summary: "Quotation QUO-1042 created (3 options)", at: dateTimeFromToday(-4, 16, 0), customerId: "c-muller", enquiryId: "e-mara", actorId: "u-grace" },
    { id: "a-3", kind: "quotation-sent", summary: "Quotation QUO-1042 sent via WhatsApp", at: dateTimeFromToday(-4, 17, 30), customerId: "c-muller", enquiryId: "e-mara", actorId: "u-grace" },
    { id: "a-4", kind: "whatsapp", summary: "Customer replied — interested in the fly-in option", at: dateTimeFromToday(0, 8, 10), customerId: "c-muller", enquiryId: "e-mara" },
    { id: "a-5", kind: "website-form", summary: "Enquiry received from the website", at: dateTimeFromToday(-30, 9, 0), customerId: "c-devos", enquiryId: "e-devos" },
    { id: "a-6", kind: "quotation-sent", summary: "Quotation QUO-1039 sent", at: dateTimeFromToday(-12, 12, 0), customerId: "c-devos", enquiryId: "e-devos", actorId: "u-grace" },
    { id: "a-7", kind: "quotation-response", summary: "Customer accepted option B", at: dateTimeFromToday(-11, 9, 0), customerId: "c-devos", enquiryId: "e-devos" },
    { id: "a-8", kind: "payment", summary: "Deposit received — EUR equivalent KES 273,000", at: dateTimeFromToday(-11, 12, 0), customerId: "c-devos", bookingId: "b-devos", actorId: "u-grace" },
    { id: "a-9", kind: "booking-confirmed", summary: "Booking BKG-508 confirmed with camp & flights", at: dateTimeFromToday(-11, 10, 30), customerId: "c-devos", bookingId: "b-devos", actorId: "u-grace" },
    { id: "a-10", kind: "call", summary: "Phone enquiry logged — school geography trip", at: dateTimeFromToday(-18, 13, 0), customerId: "c-riverside", enquiryId: "e-riverside", actorId: "u-grace" },
    { id: "a-11", kind: "payment", summary: "Deposit received via M-Pesa — KES 360,000", at: dateTimeFromToday(-6, 15, 30), customerId: "c-riverside", bookingId: "b-riverside", actorId: "u-grace" },
    { id: "a-12", kind: "stage-change", summary: "Moved to Booking in progress", at: dateTimeFromToday(-6, 14, 0), customerId: "c-riverside", enquiryId: "e-riverside", actorId: "u-grace" },
    { id: "a-13", kind: "website-form", summary: "Enquiry received from the website", at: dateTimeFromToday(-1, 16, 20), customerId: "c-njoroge", enquiryId: "e-njoroge" },
    { id: "a-14", kind: "whatsapp", summary: "New WhatsApp message from an unknown number", at: dateTimeFromToday(0, 9, 20) },
  ];

  return {
    users, customers, enquiries, quotations, quotationOptions, quotationItems,
    suppliers, bookings, payments, tasks, conversations, messages, documents, activities,
  };
}
