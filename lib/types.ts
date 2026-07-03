/**
 * Central domain models for the CRM. These mirror the Supabase relational
 * schema in `supabase/migrations` — one source of truth, no customer data
 * duplicated across records (everything references `customerId`).
 */

// --- People ----------------------------------------------------------------

export type Role = "admin" | "consultant";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  active: boolean;
};

// --- Customers -------------------------------------------------------------

export type CustomerType = "individual" | "family" | "corporate" | "group";
export type ContactMethod = "whatsapp" | "phone" | "email";

export type Customer = {
  id: string;
  name: string;
  whatsapp: string;
  email: string;
  type: CustomerType;
  assignedConsultantId: string;
  preferredContact: ContactMethod;
  preferences: string;
  previousDestinations: string[];
  company?: string;
  createdAt: string;
};

// --- Enquiries / pipeline --------------------------------------------------

export type ServiceType =
  | "flights"
  | "hotel"
  | "safari"
  | "holiday-package"
  | "transport"
  | "corporate"
  | "group";

export type PipelineStage =
  | "new"
  | "details-needed"
  | "quotation-in-progress"
  | "quotation-sent"
  | "awaiting-customer"
  | "payment-pending"
  | "booking-in-progress"
  | "confirmed";

export type WaitingOn = "team" | "customer" | "supplier" | "none";

export type LeadSource = "website" | "whatsapp" | "phone" | "email" | "referral" | "walk-in";

export type EnquiryStatus = "open" | "completed" | "lost";

export type LostReason =
  | "price"
  | "no-response"
  | "dates-changed"
  | "availability"
  | "booked-elsewhere"
  | "duplicate"
  | "other";

export type TravellerCount = { adults: number; children: number; infants: number };

export type Enquiry = {
  id: string;
  ref: string;
  customerId: string;
  service: ServiceType;
  origin: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string;
  datesFlexible: boolean;
  travellers: TravellerCount;
  budget: string;
  requirements: string;
  leadSource: LeadSource;
  assignedConsultantId: string;
  stage: PipelineStage;
  waitingOn: WaitingOn;
  nextActionLabel: string;
  nextActionDate: string; // ISO date
  estimatedValue: number;
  status: EnquiryStatus;
  lostReason?: LostReason;
  internalNotes: Note[];
  createdAt: string;
  updatedAt: string;
};

export type Note = {
  id: string;
  body: string;
  authorId: string;
  at: string;
};

// --- Quotations ------------------------------------------------------------

export type Currency = "KES" | "USD" | "EUR" | "GBP";

export type QuotationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired";

export type QuotationItemType =
  | "flight"
  | "hotel"
  | "transfer"
  | "transport"
  | "activity"
  | "insurance"
  | "visa"
  | "service-fee"
  | "custom";

export type QuotationItem = {
  id: string;
  optionId: string;
  type: QuotationItemType;
  supplier: string;
  description: string;
  startDate?: string;
  endDate?: string;
  quantity: number;
  costPrice: number;
  markupPct: number;
  sellingPrice: number;
  taxPct: number;
  notes?: string;
  cancellation?: string;
};

export type QuotationOption = {
  id: string;
  quotationId: string;
  label: "A" | "B" | "C";
  name: string;
  note?: string;
};

export type Quotation = {
  id: string;
  ref: string;
  customerId: string;
  enquiryId?: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string;
  travellers: TravellerCount;
  currency: Currency;
  validUntil: string;
  status: QuotationStatus;
  createdById: string;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  depositPct: number;
  exclusions: string[];
  terms: string;
  selectedOptionLabel?: "A" | "B" | "C";
  shareToken?: string;
};

// --- Bookings + payments ---------------------------------------------------

export type BookingStatus =
  | "awaiting-payment"
  | "being-confirmed"
  | "partially-confirmed"
  | "fully-confirmed"
  | "travel-completed"
  | "cancelled";

export type Booking = {
  id: string;
  ref: string;
  customerId: string;
  quotationId?: string;
  enquiryId?: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string;
  travellers: TravellerCount;
  servicesSummary: string[];
  amadeusPnr?: string;
  hotelRefs?: string;
  transportRef?: string;
  totalSelling: number;
  totalCost: number;
  amountPaid: number;
  status: BookingStatus;
  assignedConsultantId: string;
  createdAt: string;
};

export type PaymentMethod = "mpesa" | "bank-transfer" | "card" | "cash";

export type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  receivedAt: string;
  recordedById: string;
};

// --- Tasks -----------------------------------------------------------------

export type TaskType =
  | "follow-up-call"
  | "send-quotation"
  | "confirm-supplier"
  | "collect-payment"
  | "send-documents"
  | "general";

export type Priority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  type: TaskType;
  customerId?: string;
  enquiryId?: string;
  bookingId?: string;
  assignedToId: string;
  dueAt: string;
  priority: Priority;
  done: boolean;
  createdAt: string;
};

// --- WhatsApp --------------------------------------------------------------

export type MessageDirection = "in" | "out";
export type MessageStatus = "received" | "sent" | "delivered" | "read" | "failed" | "pending";

export type Message = {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  body: string;
  at: string;
  status: MessageStatus;
  attachmentName?: string;
  authorId?: string;
  isTemplate?: boolean;
};

export type Conversation = {
  id: string;
  customerId?: string;
  phone: string;
  displayName: string;
  assignedConsultantId?: string;
  enquiryId?: string;
  unreadCount: number;
  lastMessageAt: string;
  /** 24h customer-care window (WhatsApp policy). */
  windowExpiresAt: string;
};

// --- Documents + activity --------------------------------------------------

export type DocumentKind = "quotation" | "invoice" | "voucher" | "ticket" | "other";

export type DocumentRecord = {
  id: string;
  name: string;
  kind: DocumentKind;
  customerId?: string;
  bookingId?: string;
  uploadedById: string;
  uploadedAt: string;
};

export type ActivityKind =
  | "website-form"
  | "whatsapp"
  | "call"
  | "note"
  | "quotation-created"
  | "quotation-sent"
  | "quotation-response"
  | "payment"
  | "booking-confirmed"
  | "stage-change"
  | "task";

export type Activity = {
  id: string;
  kind: ActivityKind;
  summary: string;
  at: string;
  customerId?: string;
  enquiryId?: string;
  bookingId?: string;
  actorId?: string;
};
