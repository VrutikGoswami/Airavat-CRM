/**
 * Supabase data-access layer.
 *
 * The CRM UI is built against the in-memory `SeedData` shape (see `lib/seed.ts`)
 * with camelCase domain models (`lib/types.ts`). The live database uses
 * snake_case columns and a slightly different shape (single `travellers` count,
 * split booking statuses, a `booking_balances` view, etc.). This module is the
 * single translation boundary: it reads the real tables and assembles a
 * `SeedData` object so every screen and selector keeps working unchanged, and
 * it writes domain records back to the correct columns.
 *
 * Column names here are the authoritative live schema (verified against
 * information_schema), which differs from the committed `supabase/migrations`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeedData } from "@/lib/seed";
import { rateForCurrency } from "@/lib/fx";
import type {
  Activity,
  ActivityKind,
  Booking,
  BookingStatus,
  Conversation,
  Currency,
  Customer,
  CustomerType,
  DocumentKind,
  DocumentRecord,
  Enquiry,
  LeadSource,
  Message,
  Payment,
  PaymentMethod,
  PipelineStage,
  Priority,
  Quotation,
  QuotationItem,
  QuotationItemType,
  QuotationOption,
  QuotationStatus,
  ServiceType,
  Supplier,
  Task,
  TaskType,
  User,
  WaitingOn,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const num = (v: unknown, fallback = 0): number =>
  v == null || v === "" ? fallback : Number(v);

const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));

/** Split a free-text "not included" blob into the exclusions array the UI expects. */
function splitLines(v: unknown): string[] {
  if (!v) return [];
  return String(v)
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Row → domain mappers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapUser(r: any): User {
  const name = str(r.name);
  return {
    id: str(r.id),
    name,
    email: str(r.email),
    role: r.role === "admin" ? "admin" : "consultant",
    initials: initialsFrom(name || str(r.email) || "?"),
    active: true,
  };
}

function mapCustomer(r: any): Customer {
  return {
    id: str(r.id),
    name: str(r.name),
    whatsapp: str(r.whatsapp_number),
    email: str(r.email),
    type: (r.customer_type ?? "individual") as CustomerType,
    assignedConsultantId: str(r.assigned_to),
    preferredContact:
      r.preferred_channel === "phone" || r.preferred_channel === "email"
        ? r.preferred_channel
        : "whatsapp",
    preferences: str(r.preferences),
    previousDestinations: [],
    company: undefined,
    createdAt: str(r.created_at),
  };
}

function mapServiceType(value: unknown): ServiceType {
  switch (str(value)) {
    case "flight":
      return "flights";
    case "tour_safari":
      return "safari";
    case "holiday_package":
      return "holiday-package";
    case "hotel":
    case "transport":
    case "corporate":
    case "group":
      return str(value) as ServiceType;
    default:
      return "holiday-package";
  }
}

function serviceTypeColumn(value: ServiceType): string {
  switch (value) {
    case "flights":
      return "flight";
    case "safari":
      return "tour_safari";
    case "holiday-package":
    case "transport":
      return "holiday_package";
    case "hotel":
    case "corporate":
    case "group":
      return value;
  }
}

function mapPipelineStage(value: unknown): PipelineStage {
  switch (str(value)) {
    case "new_enquiry":
      return "new";
    case "details_needed":
      return "details-needed";
    case "quotation_in_progress":
      return "quotation-in-progress";
    case "quotation_sent":
      return "quotation-sent";
    case "awaiting_customer":
      return "awaiting-customer";
    case "payment_pending":
      return "payment-pending";
    case "booking_in_progress":
      return "booking-in-progress";
    case "confirmed":
      return "confirmed";
    default:
      return "new";
  }
}

function stageColumn(value: PipelineStage): string {
  switch (value) {
    case "new":
      return "new_enquiry";
    case "details-needed":
      return "details_needed";
    case "quotation-in-progress":
      return "quotation_in_progress";
    case "quotation-sent":
      return "quotation_sent";
    case "awaiting-customer":
      return "awaiting_customer";
    case "payment-pending":
      return "payment_pending";
    case "booking-in-progress":
      return "booking_in_progress";
    case "confirmed":
      return "confirmed";
  }
}

function mapWaitingOn(value: unknown): WaitingOn {
  switch (str(value)) {
    case "our_team":
      return "team";
    case "customer":
    case "supplier":
    case "none":
      return str(value) as WaitingOn;
    default:
      return "team";
  }
}

function waitingOnColumn(value: WaitingOn): string {
  return value === "team" ? "our_team" : value;
}

function mapTaskType(value: unknown): TaskType {
  switch (str(value)) {
    case "follow_up_call":
      return "follow-up-call";
    case "send_quotation":
      return "send-quotation";
    case "confirm_supplier":
      return "confirm-supplier";
    case "collect_payment":
      return "collect-payment";
    case "send_documents":
      return "send-documents";
    case "general":
      return "general";
    default:
      return "general";
  }
}

function taskTypeColumn(value: TaskType): string {
  return value.replace(/-/g, "_");
}

function mapPriority(value: unknown): Priority {
  switch (str(value)) {
    case "normal":
      return "medium";
    case "low":
    case "medium":
    case "high":
      return str(value) as Priority;
    default:
      return "medium";
  }
}

function priorityColumn(value: Priority): string {
  return value === "medium" ? "normal" : value;
}

function normalizeEnquiryPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const next = { ...patch };
  if (typeof next.stage === "string") next.stage = stageColumn(next.stage as PipelineStage);
  if (typeof next.waiting_on === "string") next.waiting_on = waitingOnColumn(next.waiting_on as WaitingOn);
  if (typeof next.service_type === "string") next.service_type = serviceTypeColumn(next.service_type as ServiceType);
  return next;
}

function mapEnquiry(r: any): Enquiry {
  const lost = r.lost_reason ?? undefined;
  const travellers = num(r.travellers, 1);
  return {
    id: str(r.id),
    // The live schema has no per-enquiry ref column; synthesise a stable one.
    ref: `ENQ-${str(r.id).slice(0, 5).toUpperCase()}`,
    customerId: str(r.customer_id),
    service: mapServiceType(r.service_type),
    origin: str(r.origin),
    destination: str(r.destination),
    travelStartDate: str(r.travel_start),
    travelEndDate: str(r.travel_end),
    datesFlexible: false,
    travellers: { adults: travellers, children: 0, infants: 0 },
    budget: r.budget != null ? `${str(r.budget_currency, "KES")} ${num(r.budget).toLocaleString()}` : "",
    requirements: str(r.requirements),
    leadSource: (r.lead_source ?? "website") as LeadSource,
    assignedConsultantId: str(r.assigned_to),
    stage: mapPipelineStage(r.stage),
    waitingOn: mapWaitingOn(r.waiting_on),
    nextActionLabel: str(r.next_action),
    nextActionDate: str(r.next_action_date),
    estimatedValue: num(r.budget),
    status: lost ? "lost" : "open",
    lostReason: lost,
    internalNotes: [],
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at, str(r.created_at)),
  };
}

/** Quotations borrow their trip context (destination, dates, travellers) from the enquiry. */
function mapQuotation(r: any, enquiryById: Map<string, Enquiry>): Quotation {
  const e = enquiryById.get(str(r.enquiry_id));
  const currency = (r.currency ?? "KES") as Currency;
  return {
    id: str(r.id),
    ref: str(r.reference),
    customerId: str(r.customer_id) || (e?.customerId ?? ""),
    enquiryId: r.enquiry_id ? str(r.enquiry_id) : undefined,
    destination: e?.destination ?? "",
    travelStartDate: e?.travelStartDate ?? "",
    travelEndDate: e?.travelEndDate ?? "",
    travellers: e?.travellers ?? { adults: 1, children: 0, infants: 0 },
    currency,
    exchangeRateToKes: num(r.fx_rate_to_kes) || rateForCurrency(currency),
    validUntil: str(r.validity_date),
    status: (r.status ?? "draft") as QuotationStatus,
    createdById: str(r.created_by),
    createdAt: str(r.created_at),
    sentAt: undefined,
    viewedAt: undefined,
    depositPct: num(r.deposit_pct, 30),
    exclusions: splitLines(r.not_included),
    terms: str(r.terms),
    selectedOptionLabel: undefined,
    // No share_token column; the public link resolves by quotation id instead.
    shareToken: undefined,
  };
}

function mapOption(r: any): QuotationOption {
  return {
    id: str(r.id),
    quotationId: str(r.quotation_id),
    label: (r.label ?? "A") as "A" | "B" | "C",
    name: str(r.title),
    note: undefined,
    recommended: Boolean(r.is_recommended),
  };
}

function mapItem(r: any): QuotationItem {
  return {
    id: str(r.id),
    optionId: str(r.option_id),
    type: (r.item_type ?? "custom") as QuotationItemType,
    supplier: str(r.supplier_name),
    supplierId: r.supplier_id ? str(r.supplier_id) : undefined,
    description: str(r.description),
    startDate: r.start_date ? str(r.start_date) : undefined,
    endDate: r.end_date ? str(r.end_date) : undefined,
    quantity: num(r.quantity, 1),
    costPrice: num(r.cost_price),
    markupPct: num(r.markup),
    sellingPrice: num(r.selling_price),
    taxPct: num(r.tax),
    notes: r.notes ? str(r.notes) : undefined,
    cancellation: r.cancellation_terms ? str(r.cancellation_terms) : undefined,
  };
}

function mapSupplier(r: any): Supplier {
  const t = str(r.type, "in-house");
  const allowed = ["airline", "camp", "lodge", "hotel", "transport", "activity", "in-house"];
  return {
    id: str(r.id),
    name: str(r.name),
    type: (allowed.includes(t) ? t : "in-house") as Supplier["type"],
    contact: str(r.contact),
    netRateNote: str(r.net_rate_notes),
    standardCancellation: str(r.cancellation_terms),
  };
}

/**
 * The DB tracks confirmation and payment separately (snake_case, e.g.
 * `fully_confirmed` / `balance_due`); the UI wants one kebab-case status.
 * `confirmation_status` is authoritative and mirrors the UI status names, so we
 * match it first (normalising `_`→`-`), then fall back to payment signals.
 */
function bookingStatus(confirmation: string, payment: string): BookingStatus {
  const c = confirmation.toLowerCase().replace(/_/g, "-");
  const p = payment.toLowerCase().replace(/_/g, "-");

  if (c.includes("cancel") || c.includes("void") || p.includes("cancel")) return "cancelled";
  if (c.includes("travel") || c.includes("complete") || c.includes("finished") || c.includes("done")) {
    return "travel-completed";
  }
  // Exact/keyword match on the confirmation column (the source of truth).
  if (c.includes("fully")) return "fully-confirmed";
  if (c.includes("partial")) return "partially-confirmed";
  if (c.includes("being") || c.includes("progress") || c.includes("reserved") || c.includes("book")) {
    return "being-confirmed";
  }
  // Not yet actively confirmed (pending / awaiting): lean on the payment state.
  if (p.includes("paid") && !p.includes("unpaid")) return "fully-confirmed";
  if (p.includes("balance") || p.includes("partial") || p.includes("deposit")) return "partially-confirmed";
  return "awaiting-payment";
}

// Confirmation values mirror the UI status names in snake_case (the live data
// uses `fully_confirmed`); payment values use the observed vocabulary
// (`balance_due` seen in the seed data; `unpaid`/`fully_paid` inferred).
// TODO: confirm the full allowed set against the bookings CHECK constraint.
function bookingStatusColumns(status: BookingStatus): { confirmation_status: string; payment_status: string } {
  switch (status) {
    case "awaiting-payment":
      return { confirmation_status: "pending", payment_status: "unpaid" };
    case "being-confirmed":
      return { confirmation_status: "being_confirmed", payment_status: "unpaid" };
    case "partially-confirmed":
      return { confirmation_status: "partially_confirmed", payment_status: "balance_due" };
    case "fully-confirmed":
      return { confirmation_status: "fully_confirmed", payment_status: "balance_due" };
    case "travel-completed":
      return { confirmation_status: "travel_completed", payment_status: "fully_paid" };
    case "cancelled":
      return { confirmation_status: "cancelled", payment_status: "cancelled" };
  }
}

function normalizeBookingPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const next = { ...patch };
  const rawStatus = next.status;
  if (typeof rawStatus === "string") {
    const mapped = bookingStatusColumns(rawStatus as BookingStatus);
    delete next.status;
    return { ...next, ...mapped };
  }
  return next;
}

function mapBooking(r: any, quotationById: Map<string, Quotation>): Booking {
  const q = r.quotation_id ? quotationById.get(str(r.quotation_id)) : undefined;
  return {
    id: str(r.id),
    ref: str(r.reference),
    customerId: str(r.customer_id),
    quotationId: r.quotation_id ? str(r.quotation_id) : undefined,
    enquiryId: q?.enquiryId,
    destination: str(r.destination),
    travelStartDate: str(r.travel_start),
    travelEndDate: str(r.travel_end),
    travellers: q?.travellers ?? { adults: 1, children: 0, infants: 0 },
    servicesSummary: [],
    amadeusPnr: r.amadeus_pnr ? str(r.amadeus_pnr) : undefined,
    hotelRefs: r.hotel_ref ? str(r.hotel_ref) : undefined,
    transportRef: r.transport_ref ? str(r.transport_ref) : undefined,
    totalSelling: num(r.total_selling),
    totalCost: num(r.total_cost),
    amountPaid: 0, // filled in from the booking_balances view
    status: bookingStatus(str(r.confirmation_status), str(r.payment_status)),
    assignedConsultantId: str(r.assigned_to),
    createdAt: str(r.created_at),
  };
}

function mapPayment(r: any): Payment {
  return {
    id: str(r.id),
    bookingId: str(r.booking_id),
    amount: num(r.amount),
    method: (r.method ?? "bank-transfer") as PaymentMethod,
    reference: str(r.reference),
    receivedAt: str(r.paid_at, str(r.created_at)),
    recordedById: str(r.recorded_by),
  };
}

function mapTask(r: any): Task {
  const status = str(r.status);
  return {
    id: str(r.id),
    title: str(r.title),
    type: mapTaskType(r.task_type),
    customerId: r.customer_id ? str(r.customer_id) : undefined,
    enquiryId: r.enquiry_id ? str(r.enquiry_id) : undefined,
    bookingId: r.booking_id ? str(r.booking_id) : undefined,
    assignedToId: str(r.assigned_to),
    dueAt: str(r.due_at),
    priority: mapPriority(r.priority),
    done: status === "done" || status === "completed" || r.completed_at != null,
    createdAt: str(r.created_at),
  };
}

function mapConversation(r: any, customerById: Map<string, Customer>): Conversation {
  const c = r.customer_id ? customerById.get(str(r.customer_id)) : undefined;
  return {
    id: str(r.id),
    customerId: r.customer_id ? str(r.customer_id) : undefined,
    phone: str(r.phone_number),
    displayName: c?.name ?? str(r.phone_number),
    assignedConsultantId: r.assigned_to ? str(r.assigned_to) : undefined,
    enquiryId: r.related_enquiry_id ? str(r.related_enquiry_id) : undefined,
    unreadCount: num(r.unread_count),
    lastMessageAt: str(r.last_message_at, str(r.created_at)),
    windowExpiresAt: str(r.window_expires_at),
  };
}

function mapMessage(r: any): Message {
  let attachmentName: string | undefined;
  const att = r.attachments;
  if (Array.isArray(att) && att.length > 0) {
    attachmentName = att[0]?.name ?? att[0]?.filename ?? undefined;
  }
  return {
    id: str(r.id),
    conversationId: str(r.conversation_id),
    direction: r.direction === "out" ? "out" : "in",
    body: str(r.body),
    at: str(r.created_at),
    status: (r.status ?? "received") as Message["status"],
    attachmentName,
    authorId: r.sent_by ? str(r.sent_by) : undefined,
    isTemplate: Boolean(r.template_name),
  };
}

function mapDocument(r: any): DocumentRecord {
  return {
    id: str(r.id),
    name: str(r.title),
    kind: (r.doc_type ?? "other") as DocumentKind,
    customerId: r.customer_id ? str(r.customer_id) : undefined,
    bookingId: r.booking_id ? str(r.booking_id) : undefined,
    uploadedById: str(r.created_by),
    uploadedAt: str(r.created_at),
  };
}

function mapActivity(r: any): Activity {
  const entity = str(r.entity_type);
  const id = r.entity_id ? str(r.entity_id) : undefined;
  const detail = r.detail && typeof r.detail === "object" ? r.detail : {};
  return {
    id: str(r.id),
    kind: (r.action ?? "note") as ActivityKind,
    summary: str(detail.summary) || str(r.action),
    at: str(r.created_at),
    customerId: entity === "customer" ? id : detail.customer_id,
    enquiryId: entity === "enquiry" ? id : detail.enquiry_id,
    bookingId: entity === "booking" ? id : detail.booking_id,
    actorId: r.actor ? str(r.actor) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Full load
// ---------------------------------------------------------------------------

/** Load every table into the `SeedData` shape the UI consumes. */
export async function fetchAllData(client: SupabaseClient): Promise<SeedData> {
  const [
    users,
    customers,
    enquiries,
    quotations,
    options,
    items,
    suppliers,
    bookings,
    balances,
    payments,
    tasks,
    conversations,
    messages,
    documents,
    activities,
  ] = await Promise.all([
    client.from("users").select("*"),
    client.from("customers").select("*"),
    client.from("enquiries").select("*").order("created_at", { ascending: false }),
    client.from("quotations").select("*").order("created_at", { ascending: false }),
    client.from("quotation_options").select("*"),
    client.from("quotation_items").select("*"),
    client.from("suppliers").select("*"),
    client.from("bookings").select("*").order("created_at", { ascending: false }),
    client.from("booking_balances").select("*"),
    client.from("payments").select("*").order("paid_at", { ascending: false }),
    client.from("tasks").select("*").order("due_at", { ascending: true }),
    client.from("conversations").select("*").order("last_message_at", { ascending: false }),
    client.from("messages").select("*").order("created_at", { ascending: true }),
    client.from("documents").select("*").order("created_at", { ascending: false }),
    client.from("activity_logs").select("*").order("created_at", { ascending: false }),
  ]);

  const firstError = [
    users, customers, enquiries, quotations, options, items, suppliers,
    bookings, balances, payments, tasks, conversations, messages, documents, activities,
  ].find((r) => r.error);
  if (firstError?.error) {
    throw new Error(`Supabase load failed: ${firstError.error.message}`);
  }

  const mappedEnquiries = (enquiries.data ?? []).map(mapEnquiry);
  const enquiryById = new Map(mappedEnquiries.map((e) => [e.id, e]));

  const mappedQuotations = (quotations.data ?? []).map((r) => mapQuotation(r, enquiryById));
  const quotationById = new Map(mappedQuotations.map((q) => [q.id, q]));

  const mappedOptions = (options.data ?? []).map(mapOption);
  // Reflect the recommended option as the quote's selected option label.
  for (const q of mappedQuotations) {
    const rec = mappedOptions.find((o) => o.quotationId === q.id && o.recommended);
    if (rec) q.selectedOptionLabel = rec.label;
  }

  const mappedCustomers = (customers.data ?? []).map(mapCustomer);
  const customerById = new Map(mappedCustomers.map((c) => [c.id, c]));

  const mappedBookings = (bookings.data ?? []).map((r) => mapBooking(r, quotationById));
  const balanceByBooking = new Map(
    (balances.data ?? []).map((b: any) => [str(b.booking_id), num(b.amount_paid)]),
  );
  for (const b of mappedBookings) {
    b.amountPaid = balanceByBooking.get(b.id) ?? 0;
  }

  return {
    users: (users.data ?? []).map(mapUser),
    customers: mappedCustomers,
    enquiries: mappedEnquiries,
    quotations: mappedQuotations,
    quotationOptions: mappedOptions,
    quotationItems: (items.data ?? []).map(mapItem),
    suppliers: (suppliers.data ?? []).map(mapSupplier),
    bookings: mappedBookings,
    payments: (payments.data ?? []).map(mapPayment),
    tasks: (tasks.data ?? []).map(mapTask),
    conversations: (conversations.data ?? []).map((r) => mapConversation(r, customerById)),
    messages: (messages.data ?? []).map(mapMessage),
    documents: (documents.data ?? []).map(mapDocument),
    activities: (activities.data ?? []).map(mapActivity),
  };
}

/**
 * Resolve a single quotation for the public share page. The live schema has no
 * `share_token` column, so the link resolves by quotation id (uuid).
 */
export async function fetchShareQuotation(
  client: SupabaseClient,
  id: string,
): Promise<{
  quotation: Quotation;
  customer: Customer | null;
  consultant: User | null;
  options: QuotationOption[];
  items: QuotationItem[];
} | null> {
  const { data: qRow } = await client.from("quotations").select("*").eq("id", id).maybeSingle();
  if (!qRow) return null;

  const [enq, opts, customer, consultant] = await Promise.all([
    qRow.enquiry_id
      ? client.from("enquiries").select("*").eq("id", qRow.enquiry_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("quotation_options").select("*").eq("quotation_id", id),
    qRow.customer_id
      ? client.from("customers").select("*").eq("id", qRow.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    qRow.created_by
      ? client.from("users").select("*").eq("id", qRow.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const enquiryById = new Map<string, Enquiry>();
  if (enq.data) {
    const e = mapEnquiry(enq.data);
    enquiryById.set(e.id, e);
  }
  const quotation = mapQuotation(qRow, enquiryById);
  const options = (opts.data ?? []).map(mapOption);
  const rec = options.find((o) => o.recommended);
  if (rec) quotation.selectedOptionLabel = rec.label;

  const optionIds = options.map((o) => o.id);
  const { data: itemRows } = optionIds.length
    ? await client.from("quotation_items").select("*").in("option_id", optionIds)
    : { data: [] };

  return {
    quotation,
    customer: customer.data ? mapCustomer(customer.data) : null,
    consultant: consultant.data ? mapUser(consultant.data) : null,
    options,
    items: (itemRows ?? []).map(mapItem),
  };
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

/**
 * Subscribe to changes on the tables that drive the live pipeline and WhatsApp
 * inbox. Any change triggers `onChange`, which the provider debounces into a
 * single full refetch — simple and always consistent for a dataset this size.
 */
export function subscribeToChanges(client: SupabaseClient, onChange: () => void): () => void {
  const tables = [
    "enquiries",
    "quotations",
    "quotation_options",
    "quotation_items",
    "bookings",
    "payments",
    "tasks",
    "conversations",
    "messages",
    "customers",
    "activity_logs",
  ];
  const channel = client.channel("crm-realtime");
  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  }
  channel.subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Domain → row writers (fire-and-forget from the provider's mutations)
// ---------------------------------------------------------------------------

async function run(label: string, op: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await op;
  if (error) console.error(`[db] ${label} failed:`, error);
}

export const writers = {
  insertCustomer: (c: SupabaseClient, r: Customer, createdBy?: string) =>
    run("insertCustomer", c.from("customers").insert({
      id: r.id,
      name: r.name,
      whatsapp_number: r.whatsapp,
      email: r.email || null,
      customer_type: r.type,
      preferred_channel: r.preferredContact,
      preferences: r.preferences || null,
      assigned_to: r.assignedConsultantId || null,
      created_by: createdBy ?? null,
    })),

  insertEnquiry: (c: SupabaseClient, e: Enquiry, createdBy?: string) =>
    run("insertEnquiry", c.from("enquiries").insert({
      id: e.id,
      customer_id: e.customerId,
      service_type: serviceTypeColumn(e.service),
      origin: e.origin || null,
      destination: e.destination || null,
      travel_start: e.travelStartDate || null,
      travel_end: e.travelEndDate || null,
      travellers: e.travellers.adults + e.travellers.children + e.travellers.infants,
      budget: e.estimatedValue || null,
      requirements: e.requirements || null,
      lead_source: e.leadSource,
      stage: stageColumn(e.stage),
      waiting_on: waitingOnColumn(e.waitingOn),
      next_action: e.nextActionLabel || null,
      next_action_date: e.nextActionDate || null,
      assigned_to: e.assignedConsultantId || null,
      created_by: createdBy ?? null,
    })),

  updateEnquiry: (c: SupabaseClient, id: string, patch: Record<string, unknown>) =>
    run("updateEnquiry", c.from("enquiries").update(normalizeEnquiryPatch(patch)).eq("id", id)),

  insertQuotation: (c: SupabaseClient, q: Quotation, createdBy?: string) =>
    run("insertQuotation", c.from("quotations").insert({
      id: q.id,
      enquiry_id: q.enquiryId ?? null,
      customer_id: q.customerId,
      reference: q.ref,
      currency: q.currency,
      fx_rate_to_kes: q.exchangeRateToKes,
      validity_date: q.validUntil || null,
      deposit_pct: q.depositPct,
      terms: q.terms || null,
      not_included: q.exclusions.join("\n") || null,
      status: q.status,
      created_by: createdBy ?? null,
    })),

  insertOptions: (c: SupabaseClient, opts: QuotationOption[]) =>
    run("insertOptions", c.from("quotation_options").insert(
      opts.map((o) => ({
        id: o.id,
        quotation_id: o.quotationId,
        label: o.label,
        title: o.name || null,
        is_recommended: Boolean(o.recommended),
      })),
    )),

  insertItems: (c: SupabaseClient, items: QuotationItem[]) =>
    run("insertItems", c.from("quotation_items").insert(
      items.map((i) => ({
        id: i.id,
        option_id: i.optionId,
        item_type: i.type,
        supplier_id: i.supplierId ?? null,
        supplier_name: i.supplier || null,
        description: i.description || null,
        start_date: i.startDate || null,
        end_date: i.endDate || null,
        quantity: i.quantity,
        cost_price: i.costPrice,
        markup: i.markupPct,
        selling_price: i.sellingPrice,
        tax: i.taxPct,
        cancellation_terms: i.cancellation ?? null,
        notes: i.notes ?? null,
      })),
    )),

  updateQuotation: (c: SupabaseClient, id: string, patch: Record<string, unknown>) =>
    run("updateQuotation", c.from("quotations").update(patch).eq("id", id)),

  insertBooking: (c: SupabaseClient, b: Booking, createdBy?: string) => {
    const mappedStatus = bookingStatusColumns(b.status);
    return run("insertBooking", c.from("bookings").insert({
      id: b.id,
      quotation_id: b.quotationId ?? null,
      customer_id: b.customerId,
      reference: b.ref,
      destination: b.destination || null,
      travel_start: b.travelStartDate || null,
      travel_end: b.travelEndDate || null,
      confirmation_status: mappedStatus.confirmation_status,
      payment_status: mappedStatus.payment_status,
      currency: "KES",
      total_selling: b.totalSelling,
      total_cost: b.totalCost,
      assigned_to: b.assignedConsultantId || null,
      created_by: createdBy ?? null,
    }));
  },

  updateBooking: (c: SupabaseClient, id: string, patch: Record<string, unknown>) =>
    run("updateBooking", c.from("bookings").update(normalizeBookingPatch(patch)).eq("id", id)),

  insertPayment: (c: SupabaseClient, p: Payment) =>
    run("insertPayment", c.from("payments").insert({
      id: p.id,
      booking_id: p.bookingId,
      amount: p.amount,
      currency: "KES",
      method: p.method,
      reference: p.reference || null,
      paid_at: p.receivedAt,
      recorded_by: p.recordedById || null,
    })),

  insertTask: (c: SupabaseClient, t: Task, createdBy?: string) =>
    run("insertTask", c.from("tasks").insert({
      id: t.id,
      title: t.title,
      task_type: taskTypeColumn(t.type),
      customer_id: t.customerId ?? null,
      enquiry_id: t.enquiryId ?? null,
      booking_id: t.bookingId ?? null,
      assigned_to: t.assignedToId || null,
      due_at: t.dueAt || null,
      priority: priorityColumn(t.priority),
      status: t.done ? "done" : "open",
      created_by: createdBy ?? null,
    })),

  updateTask: (c: SupabaseClient, id: string, done: boolean) =>
    run("updateTask", c.from("tasks").update({
      status: done ? "done" : "open",
      completed_at: done ? new Date().toISOString() : null,
    }).eq("id", id)),

  insertMessage: (c: SupabaseClient, m: Message) =>
    run("insertMessage", c.from("messages").insert({
      id: m.id,
      conversation_id: m.conversationId,
      direction: m.direction,
      body: m.body || null,
      template_name: m.isTemplate ? "template" : null,
      status: m.status,
      sent_by: m.authorId ?? null,
    })),

  updateConversation: (c: SupabaseClient, id: string, patch: Record<string, unknown>) =>
    run("updateConversation", c.from("conversations").update(patch).eq("id", id)),

  insertActivity: (
    c: SupabaseClient,
    a: Activity,
  ) => {
    const entity_type = a.enquiryId ? "enquiry" : a.bookingId ? "booking" : a.customerId ? "customer" : "note";
    const entity_id = a.enquiryId ?? a.bookingId ?? a.customerId ?? null;
    return run("insertActivity", c.from("activity_logs").insert({
      id: a.id,
      entity_type,
      entity_id,
      action: a.kind,
      detail: {
        summary: a.summary,
        customer_id: a.customerId ?? null,
        enquiry_id: a.enquiryId ?? null,
        booking_id: a.bookingId ?? null,
      },
      actor: a.actorId ?? null,
    }));
  },
};

/* eslint-enable @typescript-eslint/no-explicit-any */
