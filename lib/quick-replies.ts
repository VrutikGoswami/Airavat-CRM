import { company } from "@/lib/company";

/** Reusable WhatsApp quick replies. Kept short and non-committal — pricing and
 *  booking details are always sent by a consultant, not auto-filled. */
export const quickReplies: { label: string; body: string }[] = [
  { label: "Greeting", body: `Hello! Thank you for reaching out to ${company.name}. How can we help you plan your trip?` },
  { label: "Ask for details", body: "To put together the best options, could you share your travel dates, destination and number of travellers?" },
  { label: "Working on it", body: "Thank you — we're checking current options for you now and will come back shortly with details." },
  { label: "Quotation ready", body: "Your quotation is ready. We'll send it through now — do let us know if you'd like any adjustments." },
  { label: "Payment reminder", body: "A gentle reminder about the deposit to confirm your booking. Shall we send the payment details?" },
];
