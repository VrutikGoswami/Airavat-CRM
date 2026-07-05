"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSeedData, type SeedData } from "@/lib/seed";
import { optionTotals } from "@/lib/quotation";
import { toKes } from "@/lib/fx";
import { dateFromToday, isToday } from "@/lib/format";
import type {
  Activity,
  ActivityKind,
  Booking,
  BookingStatus,
  Customer,
  Enquiry,
  LostReason,
  Message,
  PaymentMethod,
  PipelineStage,
  Quotation,
  QuotationItem,
  QuotationOption,
  Supplier,
  Task,
  User,
  WaitingOn,
} from "@/lib/types";

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter}`;
}

type CreateCustomerInput = Omit<Customer, "id" | "createdAt" | "previousDestinations"> &
  Partial<Pick<Customer, "previousDestinations">>;

type CreateEnquiryInput = {
  customerId: string;
  service: Enquiry["service"];
  origin: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string;
  datesFlexible: boolean;
  travellers: Enquiry["travellers"];
  budget: string;
  requirements: string;
  leadSource: Enquiry["leadSource"];
  assignedConsultantId: string;
  estimatedValue: number;
};

type NewQuotationDraft = {
  quotation: Omit<Quotation, "id" | "ref" | "createdAt" | "status"> & { status?: Quotation["status"] };
  options: Omit<QuotationOption, "id" | "quotationId">[];
  items: (Omit<QuotationItem, "id" | "optionId"> & { optionLabel: "A" | "B" | "C" })[];
};

type CreateTaskInput = Omit<Task, "id" | "createdAt" | "done"> & { done?: boolean };

export type DashboardMetrics = {
  newEnquiries: number;
  quotationsAwaiting: number;
  followUpsDueToday: number;
  confirmedThisMonth: number;
  outstandingBalance: number;
  grossProfitThisMonth: number;
};

type WorkspaceValue = {
  currentUser: User;
  setCurrentUserId: (id: string) => void;
  data: SeedData;

  // selectors
  user: (id?: string) => User | undefined;
  customer: (id?: string) => Customer | undefined;
  enquiry: (id?: string) => Enquiry | undefined;
  quotation: (id?: string) => Quotation | undefined;
  booking: (id?: string) => Booking | undefined;
  supplier: (id?: string) => Supplier | undefined;
  optionsFor: (quotationId: string) => QuotationOption[];
  itemsForOption: (optionId: string) => QuotationItem[];
  itemsForQuotation: (quotationId: string) => QuotationItem[];
  /** Label of the option that drives the headline total (recommended → selected → first with items). */
  recommendedOptionLabel: (quotationId: string) => "A" | "B" | "C" | undefined;
  quotationTotal: (quotationId: string, optionLabel?: "A" | "B" | "C") => number;
  /** Recommended-option total converted to KES using the quote's snapshot FX rate. */
  quotationValueKes: (quotationId: string) => number;
  /** Pipeline value for an enquiry in KES: its quote's recommended total (FX-locked), else the estimate. */
  enquiryValueKes: (enquiryId: string) => number;
  messagesFor: (conversationId: string) => Message[];
  activitiesFor: (filter: { customerId?: string; enquiryId?: string; bookingId?: string }) => Activity[];
  outstandingFor: (booking: Booking) => number;
  customerOutstanding: (customerId: string) => number;
  metrics: () => DashboardMetrics;

  // mutations
  moveEnquiryStage: (enquiryId: string, stage: PipelineStage) => void;
  setWaitingOn: (enquiryId: string, waitingOn: WaitingOn) => void;
  markEnquiryLost: (enquiryId: string, reason: LostReason) => void;
  addNote: (enquiryId: string, body: string) => void;
  createCustomer: (input: CreateCustomerInput) => string;
  createEnquiry: (input: CreateEnquiryInput) => string;
  createQuotation: (draft: NewQuotationDraft) => string;
  updateQuotationStatus: (quotationId: string, status: Quotation["status"]) => void;
  convertToBooking: (quotationId: string) => string | null;
  updateBookingStatus: (bookingId: string, status: BookingStatus) => void;
  recordPayment: (bookingId: string, amount: number, method: PaymentMethod, reference: string) => void;
  createTask: (input: CreateTaskInput) => string;
  toggleTask: (taskId: string) => void;
  sendMessage: (conversationId: string, body: string, isTemplate?: boolean) => void;
  markConversationRead: (conversationId: string) => void;
  assignConversation: (conversationId: string, userId: string) => void;
  createCustomerFromConversation: (conversationId: string, name: string) => string;
  resetDemo: () => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({
  initialUserId,
  children,
}: {
  initialUserId: string;
  children: ReactNode;
}) {
  const [data, setData] = useState<SeedData>(() => createSeedData());
  const [currentUserId, setCurrentUserId] = useState(initialUserId);

  const currentUser = useMemo(
    () => data.users.find((u) => u.id === currentUserId) ?? data.users[0],
    [data.users, currentUserId],
  );

  const logActivity = useCallback(
    (draft: SeedData, kind: ActivityKind, summary: string, refs: Partial<Activity>) => {
      draft.activities = [
        { id: uid("a"), kind, summary, at: new Date().toISOString(), actorId: currentUserId, ...refs },
        ...draft.activities,
      ];
    },
    [currentUserId],
  );

  // ---- selectors ----------------------------------------------------------
  const user = useCallback((id?: string) => data.users.find((u) => u.id === id), [data.users]);
  const customer = useCallback((id?: string) => data.customers.find((c) => c.id === id), [data.customers]);
  const enquiry = useCallback((id?: string) => data.enquiries.find((e) => e.id === id), [data.enquiries]);
  const quotation = useCallback((id?: string) => data.quotations.find((q) => q.id === id), [data.quotations]);
  const booking = useCallback((id?: string) => data.bookings.find((b) => b.id === id), [data.bookings]);

  const optionsFor = useCallback(
    (quotationId: string) => data.quotationOptions.filter((o) => o.quotationId === quotationId),
    [data.quotationOptions],
  );
  const itemsForOption = useCallback(
    (optionId: string) => data.quotationItems.filter((i) => i.optionId === optionId),
    [data.quotationItems],
  );
  const itemsForQuotation = useCallback(
    (quotationId: string) => {
      const optionIds = data.quotationOptions.filter((o) => o.quotationId === quotationId).map((o) => o.id);
      return data.quotationItems.filter((i) => optionIds.includes(i.optionId));
    },
    [data.quotationOptions, data.quotationItems],
  );
  const supplier = useCallback((id?: string) => data.suppliers.find((s) => s.id === id), [data.suppliers]);

  /**
   * The option that drives a quote's headline total. Priority: an explicit
   * override, else the recommended option, else the selected option, else the
   * first option that actually has line items (never an empty shell), else the
   * first option.
   */
  const primaryOptionLabel = useCallback(
    (quotationId: string, override?: "A" | "B" | "C"): "A" | "B" | "C" | undefined => {
      const options = data.quotationOptions.filter((o) => o.quotationId === quotationId);
      if (options.length === 0) return undefined;
      if (override) return options.find((o) => o.label === override)?.label;
      const hasItems = (o: QuotationOption) => data.quotationItems.some((i) => i.optionId === o.id);
      const recommended = options.find((o) => o.recommended);
      if (recommended) return recommended.label;
      const q = data.quotations.find((x) => x.id === quotationId);
      if (q?.selectedOptionLabel) {
        const sel = options.find((o) => o.label === q.selectedOptionLabel);
        if (sel) return sel.label;
      }
      return (options.find(hasItems) ?? options[0]).label;
    },
    [data.quotationOptions, data.quotationItems, data.quotations],
  );

  const recommendedOptionLabel = useCallback(
    (quotationId: string) => primaryOptionLabel(quotationId),
    [primaryOptionLabel],
  );

  const quotationTotal = useCallback(
    (quotationId: string, optionLabel?: "A" | "B" | "C") => {
      const label = primaryOptionLabel(quotationId, optionLabel);
      if (!label) return 0;
      const opt = data.quotationOptions.find((o) => o.quotationId === quotationId && o.label === label);
      if (!opt) return 0;
      const items = data.quotationItems.filter((i) => i.optionId === opt.id);
      return optionTotals(items).total;
    },
    [primaryOptionLabel, data.quotationOptions, data.quotationItems],
  );

  const quotationValueKes = useCallback(
    (quotationId: string) => {
      const q = data.quotations.find((x) => x.id === quotationId);
      if (!q) return 0;
      return toKes(quotationTotal(quotationId), q.exchangeRateToKes);
    },
    [data.quotations, quotationTotal],
  );

  const enquiryValueKes = useCallback(
    (enquiryId: string) => {
      // Prefer a non-draft quote for this enquiry; fall back to the estimate.
      const quotes = data.quotations.filter((q) => q.enquiryId === enquiryId);
      const q = quotes.find((x) => x.status !== "draft") ?? quotes[0];
      if (q) return toKes(quotationTotal(q.id), q.exchangeRateToKes);
      return data.enquiries.find((e) => e.id === enquiryId)?.estimatedValue ?? 0;
    },
    [data.quotations, data.enquiries, quotationTotal],
  );

  const messagesFor = useCallback(
    (conversationId: string) =>
      data.messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.at.localeCompare(b.at)),
    [data.messages],
  );

  const activitiesFor = useCallback(
    (filter: { customerId?: string; enquiryId?: string; bookingId?: string }) =>
      data.activities
        .filter(
          (a) =>
            (filter.customerId && a.customerId === filter.customerId) ||
            (filter.enquiryId && a.enquiryId === filter.enquiryId) ||
            (filter.bookingId && a.bookingId === filter.bookingId),
        )
        .sort((a, b) => b.at.localeCompare(a.at)),
    [data.activities],
  );

  const outstandingFor = useCallback((b: Booking) => Math.max(0, b.totalSelling - b.amountPaid), []);

  const customerOutstanding = useCallback(
    (customerId: string) =>
      data.bookings
        .filter((b) => b.customerId === customerId && b.status !== "cancelled")
        .reduce((sum, b) => sum + Math.max(0, b.totalSelling - b.amountPaid), 0),
    [data.bookings],
  );

  const metrics = useCallback((): DashboardMetrics => {
    const month = dateFromToday(0).slice(0, 7);
    const newEnquiries = data.enquiries.filter((e) => e.status === "open" && e.stage === "new").length;
    const quotationsAwaiting = data.quotations.filter((q) => q.status === "sent" || q.status === "viewed").length;
    const followUpsDueToday = data.tasks.filter((t) => !t.done && isToday(t.dueAt)).length;
    const confirmedThisMonth = data.bookings.filter(
      (b) => b.status !== "cancelled" && b.createdAt.slice(0, 7) === month,
    ).length;
    const outstandingBalance = data.bookings
      .filter((b) => b.status !== "cancelled")
      .reduce((sum, b) => sum + Math.max(0, b.totalSelling - b.amountPaid), 0);
    const grossProfitThisMonth = data.bookings
      .filter((b) => b.status !== "cancelled" && b.createdAt.slice(0, 7) === month)
      .reduce((sum, b) => sum + (b.totalSelling - b.totalCost), 0);
    return {
      newEnquiries,
      quotationsAwaiting,
      followUpsDueToday,
      confirmedThisMonth,
      outstandingBalance,
      grossProfitThisMonth,
    };
  }, [data]);

  // ---- mutations ----------------------------------------------------------
  const update = useCallback((mutator: (draft: SeedData) => void) => {
    setData((prev) => {
      const draft: SeedData = structuredClone(prev);
      mutator(draft);
      return draft;
    });
  }, []);

  const moveEnquiryStage = useCallback(
    (enquiryId: string, stage: PipelineStage) => {
      update((draft) => {
        const e = draft.enquiries.find((x) => x.id === enquiryId);
        if (!e || e.stage === stage) return;
        e.stage = stage;
        e.updatedAt = new Date().toISOString();
        if (stage === "confirmed") e.waitingOn = "none";
        logActivity(draft, "stage-change", `Moved to ${stage.replace(/-/g, " ")}`, {
          customerId: e.customerId,
          enquiryId: e.id,
        });
      });
    },
    [update, logActivity],
  );

  const setWaitingOn = useCallback(
    (enquiryId: string, waitingOn: WaitingOn) => {
      update((draft) => {
        const e = draft.enquiries.find((x) => x.id === enquiryId);
        if (e) e.waitingOn = waitingOn;
      });
    },
    [update],
  );

  const markEnquiryLost = useCallback(
    (enquiryId: string, reason: LostReason) => {
      update((draft) => {
        const e = draft.enquiries.find((x) => x.id === enquiryId);
        if (!e) return;
        e.status = "lost";
        e.lostReason = reason;
        e.waitingOn = "none";
        e.updatedAt = new Date().toISOString();
        logActivity(draft, "note", `Enquiry marked lost (${reason.replace(/-/g, " ")})`, {
          customerId: e.customerId,
          enquiryId: e.id,
        });
      });
    },
    [update, logActivity],
  );

  const addNote = useCallback(
    (enquiryId: string, body: string) => {
      update((draft) => {
        const e = draft.enquiries.find((x) => x.id === enquiryId);
        if (!e) return;
        e.internalNotes.push({ id: uid("n"), body, authorId: currentUserId, at: new Date().toISOString() });
        logActivity(draft, "note", "Internal note added", { customerId: e.customerId, enquiryId: e.id });
      });
    },
    [update, logActivity, currentUserId],
  );

  const createCustomer = useCallback(
    (input: CreateCustomerInput) => {
      const id = uid("c");
      update((draft) => {
        draft.customers.unshift({
          ...input,
          previousDestinations: input.previousDestinations ?? [],
          id,
          createdAt: new Date().toISOString(),
        });
      });
      return id;
    },
    [update],
  );

  const createEnquiry = useCallback(
    (input: CreateEnquiryInput) => {
      const id = uid("e");
      const ref = `ENQ-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      update((draft) => {
        const now = new Date().toISOString();
        draft.enquiries.unshift({
          ...input,
          id,
          ref,
          stage: "new",
          waitingOn: "team",
          nextActionLabel: "Review new enquiry",
          nextActionDate: dateFromToday(0),
          status: "open",
          internalNotes: [],
          createdAt: now,
          updatedAt: now,
        });
        logActivity(draft, "note", "Enquiry created", { customerId: input.customerId, enquiryId: id });
      });
      return id;
    },
    [update, logActivity],
  );

  const createQuotation = useCallback(
    (draftInput: NewQuotationDraft) => {
      const id = uid("q");
      const ref = `QUO-${1044 + data.quotations.length}`;
      update((draft) => {
        draft.quotations.unshift({
          ...draftInput.quotation,
          id,
          ref,
          status: draftInput.quotation.status ?? "draft",
          createdAt: new Date().toISOString(),
        });
        const labelToOptionId: Record<string, string> = {};
        for (const opt of draftInput.options) {
          const optId = uid("qo");
          labelToOptionId[opt.label] = optId;
          draft.quotationOptions.push({ ...opt, id: optId, quotationId: id });
        }
        for (const item of draftInput.items) {
          const { optionLabel, ...rest } = item;
          const optionId = labelToOptionId[optionLabel];
          if (optionId) draft.quotationItems.push({ ...rest, id: uid("qi"), optionId });
        }
        if (draftInput.quotation.enquiryId) {
          const e = draft.enquiries.find((x) => x.id === draftInput.quotation.enquiryId);
          if (e && (e.stage === "new" || e.stage === "details-needed" || e.stage === "quotation-in-progress")) {
            e.stage = "quotation-in-progress";
          }
          logActivity(draft, "quotation-created", `Quotation ${ref} created`, {
            customerId: draftInput.quotation.customerId,
            enquiryId: draftInput.quotation.enquiryId,
          });
        }
      });
      return id;
    },
    [update, logActivity, data.quotations.length],
  );

  const updateQuotationStatus = useCallback(
    (quotationId: string, status: Quotation["status"]) => {
      update((draft) => {
        const q = draft.quotations.find((x) => x.id === quotationId);
        if (!q) return;
        q.status = status;
        if (status === "sent" && !q.sentAt) q.sentAt = new Date().toISOString();
        const e = q.enquiryId ? draft.enquiries.find((x) => x.id === q.enquiryId) : undefined;
        if (status === "sent") {
          if (e && e.status === "open") {
            e.stage = "quotation-sent";
            e.waitingOn = "customer";
          }
          logActivity(draft, "quotation-sent", `Quotation ${q.ref} sent`, { customerId: q.customerId, enquiryId: q.enquiryId });
        }
        if (status === "accepted") {
          if (e && e.status === "open") e.stage = "payment-pending";
          logActivity(draft, "quotation-response", `Quotation ${q.ref} accepted`, { customerId: q.customerId, enquiryId: q.enquiryId });
        }
        if (status === "declined") {
          logActivity(draft, "quotation-response", `Quotation ${q.ref} declined`, { customerId: q.customerId, enquiryId: q.enquiryId });
        }
      });
    },
    [update, logActivity],
  );

  const convertToBooking = useCallback(
    (quotationId: string): string | null => {
      const q = data.quotations.find((x) => x.id === quotationId);
      if (!q) return null;
      // Convert the recommended option (never a fixed/empty Option A).
      const label = primaryOptionLabel(quotationId);
      const opt = data.quotationOptions.find((o) => o.quotationId === quotationId && o.label === label);
      const items = opt ? data.quotationItems.filter((i) => i.optionId === opt.id) : [];
      const totals = optionTotals(items);
      const id = uid("b");
      const ref = `BKG-${512 + data.bookings.length}`;
      update((draft) => {
        const qd = draft.quotations.find((x) => x.id === quotationId);
        if (qd) {
          qd.status = "accepted";
          qd.selectedOptionLabel = label;
        }
        draft.bookings.unshift({
          id,
          ref,
          customerId: q.customerId,
          quotationId: q.id,
          enquiryId: q.enquiryId,
          destination: q.destination,
          travelStartDate: q.travelStartDate,
          travelEndDate: q.travelEndDate,
          travellers: q.travellers,
          servicesSummary: items.map((i) => i.description).slice(0, 6),
          totalSelling: totals.total,
          totalCost: totals.cost,
          amountPaid: 0,
          status: "awaiting-payment",
          assignedConsultantId: qd?.createdById ?? currentUserId,
          createdAt: new Date().toISOString(),
        });
        const e = q.enquiryId ? draft.enquiries.find((x) => x.id === q.enquiryId) : undefined;
        if (e) {
          e.stage = "booking-in-progress";
          e.waitingOn = "supplier";
        }
        logActivity(draft, "booking-confirmed", `Booking ${ref} created from ${q.ref}`, {
          customerId: q.customerId,
          enquiryId: q.enquiryId,
          bookingId: id,
        });
      });
      return id;
    },
    [data, update, primaryOptionLabel, currentUserId, logActivity],
  );

  const updateBookingStatus = useCallback(
    (bookingId: string, status: BookingStatus) => {
      update((draft) => {
        const b = draft.bookings.find((x) => x.id === bookingId);
        if (!b) return;
        b.status = status;
        if (status === "fully-confirmed") {
          const e = b.enquiryId ? draft.enquiries.find((x) => x.id === b.enquiryId) : undefined;
          if (e) {
            e.stage = "confirmed";
            e.waitingOn = "none";
          }
        }
        logActivity(draft, "stage-change", `Booking ${b.ref} → ${status.replace(/-/g, " ")}`, {
          customerId: b.customerId,
          bookingId: b.id,
        });
      });
    },
    [update, logActivity],
  );

  const recordPayment = useCallback(
    (bookingId: string, amount: number, method: PaymentMethod, reference: string) => {
      update((draft) => {
        const b = draft.bookings.find((x) => x.id === bookingId);
        if (!b) return;
        draft.payments.unshift({
          id: uid("p"),
          bookingId,
          amount,
          method,
          reference,
          receivedAt: new Date().toISOString(),
          recordedById: currentUserId,
        });
        b.amountPaid += amount;
        if (b.amountPaid >= b.totalSelling && b.status === "awaiting-payment") {
          b.status = "being-confirmed";
        }
        logActivity(draft, "payment", `Payment recorded (${method})`, { customerId: b.customerId, bookingId });
      });
    },
    [update, logActivity, currentUserId],
  );

  const createTask = useCallback(
    (input: CreateTaskInput) => {
      const id = uid("t");
      update((draft) => {
        draft.tasks.unshift({ ...input, id, done: input.done ?? false, createdAt: new Date().toISOString() });
      });
      return id;
    },
    [update],
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      update((draft) => {
        const t = draft.tasks.find((x) => x.id === taskId);
        if (t) t.done = !t.done;
      });
    },
    [update],
  );

  const sendMessage = useCallback(
    (conversationId: string, body: string, isTemplate = false) => {
      update((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId);
        if (!conv) return;
        draft.messages.push({
          id: uid("m"),
          conversationId,
          direction: "out",
          body,
          at: new Date().toISOString(),
          status: "sent",
          authorId: currentUserId,
          isTemplate,
        });
        conv.lastMessageAt = new Date().toISOString();
      });
    },
    [update, currentUserId],
  );

  const markConversationRead = useCallback(
    (conversationId: string) => {
      update((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId);
        if (conv) conv.unreadCount = 0;
      });
    },
    [update],
  );

  const assignConversation = useCallback(
    (conversationId: string, userId: string) => {
      update((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId);
        if (conv) conv.assignedConsultantId = userId;
      });
    },
    [update],
  );

  const createCustomerFromConversation = useCallback(
    (conversationId: string, name: string) => {
      const id = uid("c");
      update((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId);
        if (!conv) return;
        draft.customers.unshift({
          id,
          name,
          whatsapp: conv.phone,
          email: "",
          type: "individual",
          assignedConsultantId: currentUserId,
          preferredContact: "whatsapp",
          preferences: "",
          previousDestinations: [],
          createdAt: new Date().toISOString(),
        });
        conv.customerId = id;
        conv.displayName = name;
        conv.assignedConsultantId = currentUserId;
      });
      return id;
    },
    [update, currentUserId],
  );

  const resetDemo = useCallback(() => setData(createSeedData()), []);

  const value: WorkspaceValue = {
    currentUser,
    setCurrentUserId,
    data,
    user,
    customer,
    enquiry,
    quotation,
    booking,
    supplier,
    optionsFor,
    itemsForOption,
    itemsForQuotation,
    recommendedOptionLabel,
    quotationTotal,
    quotationValueKes,
    enquiryValueKes,
    messagesFor,
    activitiesFor,
    outstandingFor,
    customerOutstanding,
    metrics,
    moveEnquiryStage,
    setWaitingOn,
    markEnquiryLost,
    addNote,
    createCustomer,
    createEnquiry,
    createQuotation,
    updateQuotationStatus,
    convertToBooking,
    updateBookingStatus,
    recordPayment,
    createTask,
    toggleTask,
    sendMessage,
    markConversationRead,
    assignConversation,
    createCustomerFromConversation,
    resetDemo,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
