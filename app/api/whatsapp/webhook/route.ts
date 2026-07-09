import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { isSupabaseMode, getServiceSupabase } from "@/lib/supabase";

/**
 * Meta WhatsApp Business Cloud API webhook.
 *
 * GET  — verification handshake (Meta calls this once with hub.challenge).
 * POST — incoming message / status events.
 *
 * Structured for production but safe in demo mode: with no env configured it
 * validates and logs, without touching a database. The real implementation
 * writes each message to Supabase immediately and broadcasts via Realtime —
 * see the TODO markers and the README "WhatsApp integration" section.
 */

// --- GET: verification -----------------------------------------------------
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// --- POST: events ----------------------------------------------------------
type WhatsAppTextMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};

type WhatsAppWebhookBody = {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        messages?: WhatsAppTextMessage[];
        statuses?: { id: string; status: string; recipient_id: string }[];
        contacts?: { profile?: { name?: string }; wa_id: string }[];
      };
    }[];
  }[];
};

/** Verify the X-Hub-Signature-256 header when an app secret is configured. */
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // Not configured (demo) — skip verification.
  if (!signature) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Persist an incoming WhatsApp message: upsert the conversation by phone
 * number (opening the 24h reply window) and insert the message. Client inboxes
 * update live via Supabase Realtime on the `conversations`/`messages` tables.
 * No-op in demo mode.
 */
async function saveIncomingMessage(message: WhatsAppTextMessage): Promise<void> {
  if (!isSupabaseMode()) return;
  const db = getServiceSupabase();
  if (!db) return;

  const now = new Date();
  const windowExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await db
    .from("conversations")
    .select("id, unread_count")
    .eq("phone_number", message.from)
    .maybeSingle();

  let conversationId = existing?.id as string | undefined;
  if (conversationId) {
    await db
      .from("conversations")
      .update({
        last_message_at: now.toISOString(),
        window_expires_at: windowExpires,
        unread_count: (existing?.unread_count ?? 0) + 1,
      })
      .eq("id", conversationId);
  } else {
    const { data: created, error } = await db
      .from("conversations")
      .insert({
        phone_number: message.from,
        last_message_at: now.toISOString(),
        window_expires_at: windowExpires,
        unread_count: 1,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[whatsapp] conversation upsert failed", error);
      return;
    }
    conversationId = created.id;
  }

  const { error: msgError } = await db.from("messages").insert({
    conversation_id: conversationId,
    direction: "in",
    body: message.text?.body ?? null,
    status: "received",
    wa_message_id: message.id,
  });
  if (msgError) console.error("[whatsapp] message insert failed", msgError);
}

/** Update a sent message's delivery status by its WhatsApp message id. */
async function updateMessageStatus(waMessageId: string, status: string): Promise<void> {
  if (!isSupabaseMode()) return;
  const db = getServiceSupabase();
  if (!db) return;
  const { error } = await db.from("messages").update({ status }).eq("wa_message_id", waMessageId);
  if (error) console.error("[whatsapp] status update failed", error);
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(raw, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(raw) as WhatsAppWebhookBody;
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      // 1. Incoming messages — save immediately, then acknowledge.
      for (const message of value?.messages ?? []) {
        const contact = value?.contacts?.find((c) => c.wa_id === message.from);
        await saveIncomingMessage(message);
        console.info("[whatsapp] incoming", {
          from: message.from,
          name: contact?.profile?.name,
          text: message.text?.body,
          id: message.id,
        });
      }

      // 2. Delivery / read status updates.
      for (const status of value?.statuses ?? []) {
        await updateMessageStatus(status.id, status.status);
        console.info("[whatsapp] status", { id: status.id, status: status.status });
      }
    }
  }

  // Always 200 quickly so Meta does not retry.
  return NextResponse.json({ received: true });
}
