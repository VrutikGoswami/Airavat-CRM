import type { Booking, Priority, TaskType } from "@/lib/types";
import { balanceDueDate } from "@/lib/booking";
import { dateFromToday } from "@/lib/format";

/**
 * Auto-generated task rules from booking/quotation terms.
 *
 * These rules are pure and wired now; they PRODUCE task drafts but do not
 * persist them — the demo store must not fake saved data. When the database is
 * connected, a scheduler runs `deriveBookingTasks` on write and materialises
 * the drafts as real tasks. Until then the booking record shows them read-only
 * as "scheduled automatically".
 */
export type GeneratedTask = {
  /** Stable key for dedupe once persistence exists. */
  key: string;
  title: string;
  type: TaskType;
  dueDate: string; // ISO date
  priority: Priority;
  reason: string;
};

const FINAL_DOCS_DAYS_BEFORE_TRAVEL = 14;

function addDays(iso: string, days: number): string {
  const base = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  return new Date(base - days * 86_400_000).toISOString().slice(0, 10);
}

export function deriveBookingTasks(booking: Booking): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  const owed = booking.totalSelling - booking.amountPaid;

  if (booking.amountPaid <= 0) {
    tasks.push({
      key: `${booking.id}-deposit`,
      title: `Collect deposit — ${booking.ref}`,
      type: "collect-payment",
      dueDate: dateFromToday(0),
      priority: "high",
      reason: "No deposit received yet",
    });
  }

  const balanceDue = balanceDueDate(booking);
  if (owed > 0 && balanceDue) {
    tasks.push({
      key: `${booking.id}-balance`,
      title: `Collect balance — ${booking.ref}`,
      type: "collect-payment",
      dueDate: balanceDue,
      priority: "medium",
      reason: "Balance due 30 days before travel",
    });
  }

  if (booking.travelStartDate && booking.status !== "cancelled") {
    tasks.push({
      key: `${booking.id}-docs`,
      title: `Send final documents — ${booking.ref}`,
      type: "send-documents",
      dueDate: addDays(booking.travelStartDate, FINAL_DOCS_DAYS_BEFORE_TRAVEL),
      priority: "low",
      reason: "Two weeks before travel",
    });
  }

  return tasks;
}
