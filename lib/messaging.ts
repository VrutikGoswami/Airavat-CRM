import type { Conversation } from "@/lib/types";
import { REFERENCE_NOW } from "@/lib/format";

/**
 * WhatsApp 24-hour customer-care window state.
 *
 * Inside the window you may send free-form replies; once it closes, only an
 * approved template message may be sent until the customer replies. This is
 * derived from `Conversation.windowExpiresAt` and is ready for the Meta Cloud
 * API connection — the send path enforces `templateRequired` when live.
 */
export type MessagingWindow = {
  open: boolean;
  hoursLeft: number;
  templateRequired: boolean;
};

export function messagingWindow(
  conversation: Conversation,
  nowIso: string = REFERENCE_NOW,
): MessagingWindow {
  const expires = new Date(conversation.windowExpiresAt).getTime();
  const now = new Date(nowIso).getTime();
  const open = Number.isFinite(expires) && expires > now;
  const hoursLeft = open ? Math.max(1, Math.ceil((expires - now) / 3_600_000)) : 0;
  return { open, hoursLeft, templateRequired: !open };
}
