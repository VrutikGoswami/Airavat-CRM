import { NextResponse } from "next/server";
import crypto from "node:crypto";

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
        // TODO(production): upsert conversation + insert message into Supabase,
        // then broadcast via Realtime so the inbox updates live. Send an
        // instant template acknowledgement here — do NOT wait for AI.
        console.info("[whatsapp] incoming", {
          from: message.from,
          name: contact?.profile?.name,
          text: message.text?.body,
          id: message.id,
        });
      }

      // 2. Delivery / read status updates.
      for (const status of value?.statuses ?? []) {
        // TODO(production): update the message row's delivery status.
        console.info("[whatsapp] status", { id: status.id, status: status.status });
      }
    }
  }

  // Always 200 quickly so Meta does not retry.
  return NextResponse.json({ received: true });
}
