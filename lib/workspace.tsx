"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSeedData, type SeedData } from "@/lib/seed";
import { getBrowserSupabase, isSupabaseMode } from "@/lib/supabase";
import { fetchAllData, subscribeToChanges, writers } from "@/lib/db";
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
  Payment,
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
  // Real UUIDs so client-generated ids are valid primary keys in Supabase
  // mode; the prefix is kept only for readability/back-compat in demo mode.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter}`;
}

const EMPTY_SEED: SeedData = {
  users: [], customers: [], enquiries: [], quotations: [], quotationOptions: [],
  quotationItems: [], suppliers: [], bookings: [], payments: [], tasks: [],
  conversations: [], messages: [], documents: [], activities: [],
};

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
  const supabaseMode = isSupabaseMode();
  const [data, setData] = useState<SeedData>(() =>
    supabaseMode ? EMPTY_SEED : createSeedData(),
  );
  const [currentUserId, setCurrentUserId] = useState(initialUserId);

  // --- Supabase mode: load live data + subscribe to realtime ---------------
  const client = useMemo(() => (supabaseMode ? getBrowserSupabase() : null), [supabaseMode]);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    const load = async () => {
      try {
        const loaded = await fetchAllData(client);
        if (cancelled) return;
        setData(loaded);
        // The demo cookie's user id won't exist in the DB; snap the active user
        // to a real row so activity/actor foreign keys are valid on write.
        setCurrentUserId((prev) =>
          loaded.users.some((u) => u.id === prev) ? prev : loaded.users[0]?.id ?? prev,
        );
      } catch (err) {
        console.error("[workspace] failed to load Supabase data", err);
      }
    };

    void load();

    const unsubscribe = subscribeToChanges(client, () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void load(), 300);
    });

    return () => {
      cancelled = true;
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      unsubscribe();
    };
  }, [client]);

  /** Run a write against Supabase in production mode; a no-op in demo mode. */
  const persist = useCallback(
    (fn: (c: NonNullable<typeof client>) => void) => {
      if (client) fn(client);
    },
    [client],
  );

  const currentUser = useMemo(
    () =>
      data.users.find((u) => u.id === currentUserId) ??
      data.users[0] ?? {
        // Placeholder while live data is still loading (Supabase mode).
        id: currentUserId,
        name: "Loading…",
        email: "",
        role: "consultant" as const,
        initials: "…",
        active: true,
      },
    [data.users, currentUserId],
  );

  const logActivity = useCallback(
    (draft: SeedData, kind: ActivityKind, summary: string, refs: Partial<Activity>) => {
      const activity: Activity = {
        id: uid("a"), kind, summary, at: new Date().toISOString(), actorId: currentUserId, ...refs,
      };
      draft.activities = [activity, ...draft.activities];
      persist((c) => writers.insertActivity(c, activity));
    },
    [currentUserId, persist],
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
        persist((c) =>
          writers.updateEnquiry(c, enquiryId, {
            stage,
            ...(stage === "confirmed" ? { waiting_on: "none" } : {}),
          }),
        );
        logActivity(draft, "stage-change", `Moved to ${stage.replace(/-/g, " ")}`, {
          customerId: e.customerId,
          enquiryId: e.id,
        });
      });
    },
    [update, logActivity, persist],
  );

  const setWaitingOn = useCallback(
    (enquiryId: string, waitingOn: WaitingOn) => {
      update((draft) => {
        const e = draft.enquiries.find((x) => x.id === enquiryId);
        if (e) e.waitingOn = waitingOn;
      });
      persist((c) => writers.updateEnquiry(c, enquiryId, { waiting_on: waitingOn }));
    },
    [update, persist],
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
        persist((c) => writers.updateEnquiry(c, enquiryId, { lost_reason: reason, waiting_on: "none" }));
        logActivity(draft, "note", `Enquiry marked lost (${reason.replace(/-/g, " ")})`, {
          customerId: e.customerId,
          enquiryId: e.id,
        });
      });
    },
    [update, logActivity, persist],
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
      const record: Customer = {
        ...input,
        previousDestinations: input.previousDestinations ?? [],
        id,
        createdAt: new Date().toISOString(),
      };
      update((draft) => {
        draft.customers.unshift(record);
      });
      persist((c) => writers.insertCustomer(c, record, currentUserId));
      return id;
    },
    [update, persist, currentUserId],
  );

  const createEnquiry = useCallback(
    (input: CreateEnquiryInput) => {
      const id = uid("e");
      const ref = `ENQ-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const now = new Date().toISOString();
      const record: Enquiry = {
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
      };
      update((draft) => {
        draft.enquiries.unshift(record);
        logActivity(draft, "note", "Enquiry created", { customerId: input.customerId, enquiryId: id });
      });
      persist((c) => writers.insertEnquiry(c, record, currentUserId));
      return id;
    },
    [update, logActivity, persist, currentUserId],
  );

  const createQuotation = useCallback(
    (draftInput: NewQuotationDraft) => {
      const id = uid("q");
      const ref = `QUO-${1044 + data.quotations.length}`;
      const quotationRecord: Quotation = {
        ...draftInput.quotation,
        id,
        ref,
        status: draftInput.quotation.status ?? "draft",
        createdAt: new Date().toISOString(),
      };
      const labelToOptionId: Record<string, string> = {};
      const optionRecords: QuotationOption[] = draftInput.options.map((opt) => {
        const optId = uid("qo");
        labelToOptionId[opt.label] = optId;
        return { ...opt, id: optId, quotationId: id };
      });
      const itemRecords: QuotationItem[] = [];
      for (const item of draftInput.items) {
        const { optionLabel, ...rest } = item;
        const optionId = labelToOptionId[optionLabel];
        if (optionId) itemRecords.push({ ...rest, id: uid("qi"), optionId });
      }
      update((draft) => {
        draft.quotations.unshift(quotationRecord);
        draft.quotationOptions.push(...optionRecords);
        draft.quotationItems.push(...itemRecords);
        if (draftInput.quotation.enquiryId) {
          const e = draft.enquiries.find((x) => x.id === draftInput.quotation.enquiryId);
          if (e && (e.stage === "new" || e.stage === "details-needed" || e.stage === "quotation-in-progress")) {
            e.stage = "quotation-in-progress";
            persist((c) => writers.updateEnquiry(c, e.id, { stage: "quotation-in-progress" }));
          }
          logActivity(draft, "quotation-created", `Quotation ${ref} created`, {
            customerId: draftInput.quotation.customerId,
            enquiryId: draftInput.quotation.enquiryId,
          });
        }
      });
      persist((c) => {
        // FK order: quotation → options → items.
        void (async () => {
          await writers.insertQuotation(c, quotationRecord, currentUserId);
          if (optionRecords.length) await writers.insertOptions(c, optionRecords);
          if (itemRecords.length) await writers.insertItems(c, itemRecords);
        })();
      });
      return id;
    },
    [update, logActivity, persist, currentUserId, data.quotations.length],
  );

  const updateQuotationStatus = useCallback(
    (quotationId: string, status: Quotation["status"]) => {
      update((draft) => {
        const q = draft.quotations.find((x) => x.id === quotationId);
        if (!q) return;
        q.status = status;
        if (status === "sent" && !q.sentAt) q.sentAt = new Date().toISOString();
        persist((c) => writers.updateQuotation(c, quotationId, { status }));
        const e = q.enquiryId ? draft.enquiries.find((x) => x.id === q.enquiryId) : undefined;
        if (status === "sent") {
          if (e && e.status === "open") {
            e.stage = "quotation-sent";
            e.waitingOn = "customer";
            persist((c) => writers.updateEnquiry(c, e.id, { stage: "quotation-sent", waiting_on: "customer" }));
          }
          logActivity(draft, "quotation-sent", `Quotation ${q.ref} sent`, { customerId: q.customerId, enquiryId: q.enquiryId });
        }
        if (status === "accepted") {
          if (e && e.status === "open") {
            e.stage = "payment-pending";
            persist((c) => writers.updateEnquiry(c, e.id, { stage: "payment-pending" }));
          }
          logActivity(draft, "quotation-response", `Quotation ${q.ref} accepted`, { customerId: q.customerId, enquiryId: q.enquiryId });
        }
        if (status === "declined") {
          logActivity(draft, "quotation-response", `Quotation ${q.ref} declined`, { customerId: q.customerId, enquiryId: q.enquiryId });
        }
      });
    },
    [update, logActivity, persist],
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
      const bookingRecord: Booking = {
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
        assignedConsultantId: q.createdById ?? currentUserId,
        createdAt: new Date().toISOString(),
      };
      update((draft) => {
        const qd = draft.quotations.find((x) => x.id === quotationId);
        if (qd) {
          qd.status = "accepted";
          qd.selectedOptionLabel = label;
        }
        draft.bookings.unshift(bookingRecord);
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
      persist((c) => {
        writers.updateQuotation(c, quotationId, { status: "accepted" });
        writers.insertBooking(c, bookingRecord, currentUserId);
        if (q.enquiryId) {
          writers.updateEnquiry(c, q.enquiryId, { stage: "booking-in-progress", waiting_on: "supplier" });
        }
      });
      return id;
    },
    [data, update, primaryOptionLabel, currentUserId, logActivity, persist],
  );

  const updateBookingStatus = useCallback(
    (bookingId: string, status: BookingStatus) => {
      update((draft) => {
        const b = draft.bookings.find((x) => x.id === bookingId);
        if (!b) return;
        b.status = status;
        persist((c) => writers.updateBooking(c, bookingId, { status }));
        if (status === "fully-confirmed") {
          const e = b.enquiryId ? draft.enquiries.find((x) => x.id === b.enquiryId) : undefined;
          if (e) {
            e.stage = "confirmed";
            e.waitingOn = "none";
            persist((c) => writers.updateEnquiry(c, e.id, { stage: "confirmed", waiting_on: "none" }));
          }
        }
        logActivity(draft, "stage-change", `Booking ${b.ref} → ${status.replace(/-/g, " ")}`, {
          customerId: b.customerId,
          bookingId: b.id,
        });
      });
    },
    [update, logActivity, persist],
  );

  const recordPayment = useCallback(
    (bookingId: string, amount: number, method: PaymentMethod, reference: string) => {
      const payment: Payment = {
        id: uid("p"),
        bookingId,
        amount,
        method,
        reference,
        receivedAt: new Date().toISOString(),
        recordedById: currentUserId,
      };
      update((draft) => {
        const b = draft.bookings.find((x) => x.id === bookingId);
        if (!b) return;
        draft.payments.unshift(payment);
        b.amountPaid += amount;
        if (b.amountPaid >= b.totalSelling && b.status === "awaiting-payment") {
          b.status = "being-confirmed";
        }
        logActivity(draft, "payment", `Payment recorded (${method})`, { customerId: b.customerId, bookingId });
      });
      // amount_paid/outstanding come from the booking_balances view, which
      // recomputes from this payment row — the realtime refetch reconciles it.
      persist((c) => writers.insertPayment(c, payment));
    },
    [update, logActivity, currentUserId, persist],
  );

  const createTask = useCallback(
    (input: CreateTaskInput) => {
      const id = uid("t");
      const record: Task = { ...input, id, done: input.done ?? false, createdAt: new Date().toISOString() };
      update((draft) => {
        draft.tasks.unshift(record);
      });
      persist((c) => writers.insertTask(c, record, currentUserId));
      return id;
    },
    [update, persist, currentUserId],
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      const next = !(data.tasks.find((x) => x.id === taskId)?.done ?? false);
      update((draft) => {
        const t = draft.tasks.find((x) => x.id === taskId);
        if (t) t.done = next;
      });
      persist((c) => writers.updateTask(c, taskId, next));
    },
    [update, persist, data.tasks],
  );

  const sendMessage = useCallback(
    (conversationId: string, body: string, isTemplate = false) => {
      const now = new Date().toISOString();
      const message: Message = {
        id: uid("m"),
        conversationId,
        direction: "out",
        body,
        at: now,
        status: "sent",
        authorId: currentUserId,
        isTemplate,
      };
      update((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId);
        if (!conv) return;
        draft.messages.push(message);
        conv.lastMessageAt = now;
      });
      persist((c) => {
        writers.insertMessage(c, message);
        writers.updateConversation(c, conversationId, { last_message_at: now });
      });
    },
    [update, currentUserId, persist],
  );

  const markConversationRead = useCallback(
    (conversationId: string) => {
      update((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId);
        if (conv) conv.unreadCount = 0;
      });
      persist((c) => writers.updateConversation(c, conversationId, { unread_count: 0 }));
    },
    [update, persist],
  );

  const assignConversation = useCallback(
    (conversationId: string, userId: string) => {
      update((draft) => {
        const conv = draft.conversations.find((c) => c.id === conversationId);
        if (conv) conv.assignedConsultantId = userId;
      });
      persist((c) => writers.updateConversation(c, conversationId, { assigned_to: userId }));
    },
    [update, persist],
  );

  const createCustomerFromConversation = useCallback(
    (conversationId: string, name: string) => {
      const id = uid("c");
      const conv = data.conversations.find((c) => c.id === conversationId);
      const record: Customer = {
        id,
        name,
        whatsapp: conv?.phone ?? "",
        email: "",
        type: "individual",
        assignedConsultantId: currentUserId,
        preferredContact: "whatsapp",
        preferences: "",
        previousDestinations: [],
        createdAt: new Date().toISOString(),
      };
      update((draft) => {
        const c = draft.conversations.find((x) => x.id === conversationId);
        if (!c) return;
        draft.customers.unshift(record);
        c.customerId = id;
        c.displayName = name;
        c.assignedConsultantId = currentUserId;
      });
      persist((c) => {
        void (async () => {
          await writers.insertCustomer(c, record, currentUserId);
          await writers.updateConversation(c, conversationId, {
            customer_id: id,
            assigned_to: currentUserId,
          });
        })();
      });
      return id;
    },
    [update, currentUserId, persist, data.conversations],
  );

  const resetDemo = useCallback(() => {
    // In production mode there is nothing to "reset" — just reload from the DB.
    if (client) {
      void fetchAllData(client).then(setData).catch((e) => console.error(e));
      return;
    }
    setData(createSeedData());
  }, [client]);

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
