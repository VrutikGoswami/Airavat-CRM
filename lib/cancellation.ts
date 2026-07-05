/**
 * Cancellation-deadline tracking.
 *
 * Quotation items currently carry free-text cancellation terms. This interim
 * parser derives a deadline date from common phrasings so upcoming deadlines
 * can surface in "Needs attention". When the supplier directory / database
 * lands, these become structured fields and the parser is retired — the
 * consuming UI stays the same.
 */

export type CancellationDeadline = {
  /** ISO date after which the penalty applies (or the free-cancellation cutoff). */
  deadline: string;
  /** The original terms, shown verbatim. */
  penalty: string;
};

function addDays(iso: string, days: number): string {
  const base = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  return new Date(base - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Derive a deadline from a cancellation phrase relative to travel start.
 * Handles "within N days", "within N hours"/"Nh", and "free until Nh before".
 * Returns null when the phrasing can't be understood (e.g. "airline fare rules apply").
 */
export function deadlineFromCancellation(
  cancellation: string | undefined,
  travelStartDate: string,
): CancellationDeadline | null {
  if (!cancellation || !travelStartDate) return null;
  const text = cancellation.toLowerCase();

  const hours = text.match(/(\d+)\s*(?:h|hours?)\b/);
  const days = text.match(/(\d+)\s*days?/);

  let leadDays: number | null = null;
  if (days) leadDays = Number(days[1]);
  else if (hours) leadDays = Math.ceil(Number(hours[1]) / 24);

  if (leadDays === null || Number.isNaN(leadDays)) return null;
  return { deadline: addDays(travelStartDate, leadDays), penalty: cancellation };
}

/** Whole days from `fromIso` until `iso` (negative = past). */
export function daysBetween(fromIso: string, iso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
