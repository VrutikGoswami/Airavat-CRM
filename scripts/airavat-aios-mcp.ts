import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const projectRoot = path.resolve(path.dirname(path.resolve(process.argv[1])), "..");

function loadLocalEnv() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  process.stderr.write(
    "Airavat AIOS MCP requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Airavat-CRM/.env.local.\n",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type JsonRecord = Record<string, unknown>;
type QuotationTotals = {
  cost: number;
  selling_ex_tax: number;
  tax: number;
  total: number;
  margin: number;
};

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: { result: data },
  };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function assertNoError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function enquiryReference(id: unknown) {
  return `ENQ-${String(id ?? "").slice(0, 5).toUpperCase()}`;
}

function quotationTotal(items: JsonRecord[]) {
  return items.reduce<QuotationTotals>(
    (totals, item) => {
      const quantity = Number(item.quantity ?? 1);
      const selling = Number(item.selling_price ?? 0) * quantity;
      const cost = Number(item.cost_price ?? 0) * quantity;
      const tax = (selling * Number(item.tax ?? 0)) / 100;
      return {
        cost: totals.cost + cost,
        selling_ex_tax: totals.selling_ex_tax + selling,
        tax: totals.tax + tax,
        total: totals.total + selling + tax,
        margin: totals.margin + selling - cost,
      };
    },
    { cost: 0, selling_ex_tax: 0, tax: 0, total: 0, margin: 0 },
  );
}

async function resolveEnquiry(identifier: string) {
  const trimmed = identifier.trim();
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(trimmed)) {
    const { data, error } = await supabase.from("enquiries").select("*").eq("id", trimmed).maybeSingle();
    assertNoError(error, "Could not load enquiry");
    return data as JsonRecord | null;
  }

  const prefix = trimmed.replace(/^ENQ-/i, "").toLowerCase();
  const { data, error } = await supabase.from("enquiries").select("*").order("created_at", { ascending: false });
  assertNoError(error, "Could not resolve enquiry reference");

  const matches = ((data ?? []) as JsonRecord[]).filter((row) =>
    String(row.id ?? "").toLowerCase().startsWith(prefix),
  );
  if (matches.length > 1) {
    throw new Error(`Enquiry reference ${identifier} is ambiguous. Use the full enquiry id.`);
  }
  return matches[0] ?? null;
}

async function fetchEnquiryBrief(
  identifier: string,
  includeMessages: boolean,
  client: SupabaseClient = supabase,
) {
  const enquiry = await resolveEnquiry(identifier);
  if (!enquiry) throw new Error(`Enquiry ${identifier} was not found.`);

  const enquiryId = String(enquiry.id);
  const customerId = String(enquiry.customer_id);

  const [
    customerResult,
    consultantResult,
    quotationsResult,
    tasksResult,
    activityResult,
    conversationsResult,
  ] = await Promise.all([
    client.from("customers").select("*").eq("id", customerId).maybeSingle(),
    enquiry.assigned_to
      ? client.from("users").select("id,name,email,role").eq("id", String(enquiry.assigned_to)).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client.from("quotations").select("*").eq("enquiry_id", enquiryId).order("created_at", { ascending: false }),
    client.from("tasks").select("*").eq("enquiry_id", enquiryId).order("due_at", { ascending: true }),
    client
      .from("activity_logs")
      .select("*")
      .eq("entity_type", "enquiry")
      .eq("entity_id", enquiryId)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("conversations")
      .select("id,customer_id,phone_number,assigned_to,related_enquiry_id,last_message_at,unread_count")
      .eq("related_enquiry_id", enquiryId),
  ]);

  for (const [context, result] of [
    ["Could not load customer", customerResult],
    ["Could not load consultant", consultantResult],
    ["Could not load quotations", quotationsResult],
    ["Could not load tasks", tasksResult],
    ["Could not load activity", activityResult],
    ["Could not load conversations", conversationsResult],
  ] as const) {
    assertNoError(result.error, context);
  }

  const quotations = (quotationsResult.data ?? []) as JsonRecord[];
  const quotationIds = quotations.map((row) => String(row.id));
  const optionsResult = quotationIds.length
    ? await client.from("quotation_options").select("*").in("quotation_id", quotationIds)
    : { data: [], error: null };
  assertNoError(optionsResult.error, "Could not load quotation options");

  const options = (optionsResult.data ?? []) as JsonRecord[];
  const optionIds = options.map((row) => String(row.id));
  const itemsResult = optionIds.length
    ? await client.from("quotation_items").select("*").in("option_id", optionIds)
    : { data: [], error: null };
  assertNoError(itemsResult.error, "Could not load quotation items");
  const items = (itemsResult.data ?? []) as JsonRecord[];

  const conversationIds = ((conversationsResult.data ?? []) as JsonRecord[]).map((row) => String(row.id));
  const messagesResult =
    includeMessages && conversationIds.length
      ? await client
          .from("messages")
          .select("id,conversation_id,direction,body,status,created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [], error: null };
  assertNoError(messagesResult.error, "Could not load messages");

  return {
    enquiry: { ...enquiry, reference: enquiryReference(enquiry.id) },
    customer: customerResult.data,
    assigned_consultant: consultantResult.data,
    quotations: quotations.map((quotation) => {
      const quotationOptions = options.filter((option) => option.quotation_id === quotation.id);
      return {
        ...quotation,
        options: quotationOptions.map((option) => {
          const optionItems = items.filter((item) => item.option_id === option.id);
          return {
            ...option,
            totals: quotationTotal(optionItems),
            items: optionItems,
          };
        }),
      };
    }),
    tasks: tasksResult.data ?? [],
    recent_activity: activityResult.data ?? [],
    conversations: conversationsResult.data ?? [],
    recent_messages: messagesResult.data ?? [],
    guardrails: [
      "Supplier rates do not prove live availability.",
      "Customer communication, price changes, quotation sending, and booking require human approval.",
    ],
  };
}

const server = new McpServer(
  { name: "airavat-aios", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.registerTool(
  "aios_health",
  {
    title: "Check Airavat AIOS",
    description: "Verify the CRM intelligence connection and return non-sensitive record counts.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async () => {
    try {
      const [enquiries, customers, hotels, openTasks] = await Promise.all([
        supabase.from("enquiries").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("rate_hotels").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "open"),
      ]);
      for (const result of [enquiries, customers, hotels, openTasks]) {
        assertNoError(result.error, "AIOS health check failed");
      }
      return ok({
        status: "connected",
        records: {
          enquiries: enquiries.count ?? 0,
          customers: customers.count ?? 0,
          active_hotels: hotels.count ?? 0,
          open_tasks: openTasks.count ?? 0,
        },
        mode: "human-approved operations",
      });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "list_enquiries",
  {
    title: "List CRM enquiries",
    description:
      "List recent CRM enquiries with customer and consultant context. Use this to find an enquiry before requesting its full brief.",
    inputSchema: {
      service_type: z.string().optional().describe("CRM service type, for example hotel, flight, or holiday_package"),
      stage: z.string().optional().describe("CRM pipeline stage"),
      assigned_to: z.string().uuid().optional().describe("Consultant user id"),
      limit: z.number().int().min(1).max(100).default(20),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ service_type, stage, assigned_to, limit }) => {
    try {
      let query = supabase
        .from("enquiries")
        .select("*,customers(id,name,email,whatsapp_number),users!enquiries_assigned_to_fkey(id,name,email)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (service_type) query = query.eq("service_type", service_type);
      if (stage) query = query.eq("stage", stage);
      if (assigned_to) query = query.eq("assigned_to", assigned_to);
      const { data, error } = await query;
      assertNoError(error, "Could not list enquiries");
      return ok(
        ((data ?? []) as JsonRecord[]).map((row) => ({
          ...row,
          reference: enquiryReference(row.id),
        })),
      );
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "get_enquiry_brief",
  {
    title: "Get enquiry intelligence brief",
    description:
      "Load one enquiry with customer, consultant, quotation options and items, tasks, and recent audit context. Messages are excluded unless explicitly requested.",
    inputSchema: {
      enquiry: z.string().min(1).describe("Full enquiry UUID or the ENQ- reference returned by list_enquiries"),
      include_messages: z.boolean().default(false),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ enquiry, include_messages }) => {
    try {
      return ok(await fetchEnquiryBrief(enquiry, include_messages));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "list_tasks",
  {
    title: "List CRM tasks",
    description: "List CRM tasks, optionally filtered by status, consultant, enquiry, or due date.",
    inputSchema: {
      status: z.string().default("open"),
      assigned_to: z.string().uuid().optional(),
      enquiry_id: z.string().uuid().optional(),
      due_before: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(100).default(30),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ status, assigned_to, enquiry_id, due_before, limit }) => {
    try {
      let query = supabase
        .from("tasks")
        .select("*,customers(id,name),enquiries(id,destination,service_type),users!tasks_assigned_to_fkey(id,name,email)")
        .order("due_at", { ascending: true })
        .limit(limit);
      if (status) query = query.eq("status", status);
      if (assigned_to) query = query.eq("assigned_to", assigned_to);
      if (enquiry_id) query = query.eq("enquiry_id", enquiry_id);
      if (due_before) query = query.lte("due_at", due_before);
      const { data, error } = await query;
      assertNoError(error, "Could not list tasks");
      return ok(data ?? []);
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "search_hotel_catalog",
  {
    title: "Search approved hotel rates",
    description:
      "Search active Airavat hotels and approved supplier rate rows. Returned rates are reference rates, not live availability.",
    inputSchema: {
      destination: z.string().min(2),
      check_in: z.string().date().optional(),
      check_out: z.string().date().optional(),
      limit: z.number().int().min(1).max(30).default(10),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ destination, check_in, check_out, limit }) => {
    try {
      const safeDestination = destination.replace(/[%(),.]/g, " ").replace(/\s+/g, " ").trim();
      if (safeDestination.length < 2) throw new Error("Enter a destination with at least two letters.");

      const { data: hotels, error: hotelError } = await supabase
        .from("rate_hotels")
        .select("*")
        .eq("active", true)
        .or(
          `destination_name.ilike.%${safeDestination}%,city.ilike.%${safeDestination}%,country.ilike.%${safeDestination}%`,
        )
        .limit(limit);
      assertNoError(hotelError, "Could not search hotels");

      const hotelRows = (hotels ?? []) as JsonRecord[];
      const hotelIds = hotelRows.map((hotel) => String(hotel.id));
      if (!hotelIds.length) return ok([]);

      let rateQuery = supabase
        .from("hotel_rate_rows")
        .select(
          "id,hotel_id,rate_type,season_name,valid_from,valid_to,booking_by,blackout_dates,room_type,meal_plan,occupancy,adults,children,amount,currency,market,unit_basis,minimum_stay,tax_included,commission_included,child_policy,cancellation_policy,payment_terms,conditions,source_page,ai_confidence",
        )
        .in("hotel_id", hotelIds)
        .eq("review_status", "approved")
        .eq("active", true);
      if (check_in) rateQuery = rateQuery.lte("valid_from", check_in).gte("valid_to", check_in);
      if (check_out) rateQuery = rateQuery.gte("valid_to", check_out);

      const { data: rates, error: rateError } = await rateQuery.order("amount", { ascending: true });
      assertNoError(rateError, "Could not load approved hotel rates");

      const rateRows = (rates ?? []) as JsonRecord[];
      return ok(
        hotelRows.map((hotel) => ({
          ...hotel,
          approved_rates: rateRows.filter((rate) => rate.hotel_id === hotel.id),
          availability_status: "not_checked",
        })),
      );
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "create_follow_up_task",
  {
    title: "Create a confirmed follow-up task",
    description:
      "Create an internal CRM follow-up task. This changes CRM data and must only be called after the user explicitly approves the exact task.",
    inputSchema: {
      enquiry_id: z.string().uuid(),
      title: z.string().min(3).max(240),
      due_at: z.string().datetime(),
      assigned_to: z.string().uuid().optional(),
      priority: z.enum(["low", "normal", "high"]).default("normal"),
      task_type: z
        .enum(["follow_up_call", "send_quotation", "confirm_supplier", "collect_payment", "send_documents", "general"])
        .default("general"),
      confirm: z.boolean().describe("Must be true only after explicit user confirmation"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async ({ enquiry_id, title, due_at, assigned_to, priority, task_type, confirm }) => {
    try {
      if (!confirm) {
        throw new Error("Confirmation required. Review the task with the user, then call again with confirm: true.");
      }
      const enquiry = await resolveEnquiry(enquiry_id);
      if (!enquiry) throw new Error(`Enquiry ${enquiry_id} was not found.`);

      const task = {
        id: randomUUID(),
        title,
        task_type,
        customer_id: enquiry.customer_id,
        enquiry_id,
        assigned_to: assigned_to ?? enquiry.assigned_to ?? null,
        due_at,
        priority,
        status: "open",
        auto_generated: true,
      };
      const { data, error } = await supabase.from("tasks").insert(task).select("*").single();
      assertNoError(error, "Could not create follow-up task");
      return ok({ created: true, task: data });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "record_enquiry_recommendation",
  {
    title: "Record a confirmed AI recommendation",
    description:
      "Record a Hermes recommendation in the enquiry audit trail. This does not contact the customer, change a price, or change pipeline state.",
    inputSchema: {
      enquiry_id: z.string().uuid(),
      summary: z.string().min(10).max(1000),
      rationale: z.string().max(3000).optional(),
      next_step: z.string().max(500).optional(),
      confirm: z.boolean().describe("Must be true only after explicit user confirmation"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async ({ enquiry_id, summary, rationale, next_step, confirm }) => {
    try {
      if (!confirm) {
        throw new Error(
          "Confirmation required. Show the recommendation to the user, then call again with confirm: true.",
        );
      }
      const enquiry = await resolveEnquiry(enquiry_id);
      if (!enquiry) throw new Error(`Enquiry ${enquiry_id} was not found.`);

      const activity = {
        id: randomUUID(),
        entity_type: "enquiry",
        entity_id: enquiry_id,
        action: "hermes_recommendation",
        detail: {
          summary,
          rationale: rationale ?? null,
          next_step: next_step ?? null,
          source: "hermes-agent",
          customer_id: enquiry.customer_id,
        },
      };
      const { data, error } = await supabase.from("activity_logs").insert(activity).select("*").single();
      assertNoError(error, "Could not record recommendation");
      return ok({ recorded: true, activity: data });
    } catch (error) {
      return fail(error);
    }
  },
);

const transport = new StdioServerTransport();

async function main() {
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
