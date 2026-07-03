import type {
  BookingStatus,
  ContactMethod,
  CustomerType,
  LeadSource,
  LostReason,
  PaymentMethod,
  PipelineStage,
  Priority,
  QuotationItemType,
  QuotationStatus,
  ServiceType,
  TaskType,
  WaitingOn,
} from "@/lib/types";

/** Ordered visible pipeline stages (Completed/Lost live in archive views). */
export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: "new", label: "New enquiry" },
  { id: "details-needed", label: "Details needed" },
  { id: "quotation-in-progress", label: "Quotation in progress" },
  { id: "quotation-sent", label: "Quotation sent" },
  { id: "awaiting-customer", label: "Awaiting customer" },
  { id: "payment-pending", label: "Payment pending" },
  { id: "booking-in-progress", label: "Booking in progress" },
  { id: "confirmed", label: "Confirmed" },
];

export const stageLabel = (s: PipelineStage): string =>
  PIPELINE_STAGES.find((x) => x.id === s)?.label ?? s;

export const SERVICE_LABELS: Record<ServiceType, string> = {
  flights: "Flights",
  hotel: "Hotel",
  safari: "Tour / safari",
  "holiday-package": "Holiday package",
  transport: "Transport",
  corporate: "Corporate travel",
  group: "Group travel",
};

export const WAITING_ON_LABELS: Record<WaitingOn, string> = {
  team: "Our team",
  customer: "Customer",
  supplier: "Supplier",
  none: "No one",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "Individual",
  family: "Family",
  corporate: "Corporate",
  group: "Group",
};

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  whatsapp: "WhatsApp",
  phone: "Phone",
  email: "Email",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
  phone: "Phone",
  email: "Email",
  referral: "Referral",
  "walk-in": "Walk-in",
};

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  price: "Price",
  "no-response": "No response",
  "dates-changed": "Dates changed",
  availability: "Availability",
  "booked-elsewhere": "Booked elsewhere",
  duplicate: "Duplicate",
  other: "Other",
};

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export const QUOTATION_ITEM_LABELS: Record<QuotationItemType, string> = {
  flight: "Flight",
  hotel: "Hotel / safari camp",
  transfer: "Airport transfer",
  transport: "Private transport",
  activity: "Tour or activity",
  insurance: "Travel insurance",
  visa: "Visa assistance",
  "service-fee": "Service fee",
  custom: "Custom item",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  "awaiting-payment": "Awaiting payment",
  "being-confirmed": "Being confirmed",
  "partially-confirmed": "Partially confirmed",
  "fully-confirmed": "Fully confirmed",
  "travel-completed": "Travel completed",
  cancelled: "Cancelled",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  "follow-up-call": "Follow-up call",
  "send-quotation": "Send quotation",
  "confirm-supplier": "Confirm supplier",
  "collect-payment": "Collect payment",
  "send-documents": "Send documents",
  general: "General task",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  "bank-transfer": "Bank transfer",
  card: "Card",
  cash: "Cash",
};

/** Tone tokens map to CSS classes defined in globals.css (badge-*). */
export const STAGE_TONE: Record<PipelineStage, string> = {
  new: "info",
  "details-needed": "neutral",
  "quotation-in-progress": "warning",
  "quotation-sent": "info",
  "awaiting-customer": "warning",
  "payment-pending": "warning",
  "booking-in-progress": "info",
  confirmed: "success",
};

export const QUOTATION_STATUS_TONE: Record<QuotationStatus, string> = {
  draft: "neutral",
  sent: "info",
  viewed: "info",
  accepted: "success",
  declined: "error",
  expired: "neutral",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, string> = {
  "awaiting-payment": "warning",
  "being-confirmed": "info",
  "partially-confirmed": "info",
  "fully-confirmed": "success",
  "travel-completed": "neutral",
  cancelled: "error",
};
