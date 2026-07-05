import type { Booking, DocumentKind, Payment } from "@/lib/types";

/**
 * Document-generation rules: an invoice + receipt for each recorded payment,
 * and a travel voucher / itinerary pack once a booking is confirmed.
 *
 * Pure and wired now, but nothing is persisted — file generation and storage
 * (Supabase Storage, signed URLs) complete with the database. The Documents
 * tab shows these as "generated automatically", ready to download once the
 * backend is connected.
 */
export type GeneratedDocument = {
  key: string;
  name: string;
  kind: DocumentKind;
  bookingId: string;
  reason: string;
  at: string;
};

export function deriveCustomerDocuments(
  customerId: string,
  bookings: Booking[],
  payments: Payment[],
): GeneratedDocument[] {
  const mine = bookings.filter((b) => b.customerId === customerId && b.status !== "cancelled");
  const docs: GeneratedDocument[] = [];

  for (const booking of mine) {
    // Invoice once a booking exists.
    docs.push({
      key: `${booking.id}-invoice`,
      name: `Invoice — ${booking.ref}`,
      kind: "invoice",
      bookingId: booking.id,
      reason: "Generated when the booking is created",
      at: booking.createdAt,
    });

    // Receipt per recorded payment.
    for (const payment of payments.filter((p) => p.bookingId === booking.id)) {
      docs.push({
        key: `${payment.id}-receipt`,
        name: `Receipt — ${booking.ref} · ${payment.reference}`,
        kind: "invoice",
        bookingId: booking.id,
        reason: "Generated on each recorded payment",
        at: payment.receivedAt,
      });
    }

    // Voucher / itinerary pack once confirmed.
    if (booking.status === "fully-confirmed" || booking.status === "partially-confirmed") {
      docs.push({
        key: `${booking.id}-voucher`,
        name: `Travel voucher & itinerary — ${booking.ref}`,
        kind: "voucher",
        bookingId: booking.id,
        reason: "Generated at confirmation",
        at: booking.createdAt,
      });
    }
  }

  return docs.sort((a, b) => b.at.localeCompare(a.at));
}
