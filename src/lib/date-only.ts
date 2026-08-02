/**
 * Helpers for `@db.Date` columns (Attendance.date, Holiday.date, Payslip
 * period bounds).
 *
 * Postgres `date` has no time or zone. Prisma maps it to a JS `Date` at
 * UTC midnight, and truncates whatever you send it to its **UTC** date part.
 *
 * That makes the obvious code wrong outside UTC:
 *
 *   new Date(2026, 6, 1)          // local midnight, 1 Jul
 *   → 2026-06-30T19:00:00Z        // in UTC+5
 *   → stored as 2026-06-30        // off by one day
 *
 * So every calendar date crossing this boundary is built at UTC midnight and
 * read back with the UTC accessors. Never use getDate()/getDay() on a value
 * that came from one of these columns — use the helpers here.
 */

/** UTC midnight for a calendar date. */
export function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Today in the *server's local* calendar, as a UTC-midnight date-only value. */
export function todayDateOnly(): Date {
  const now = new Date();
  return dateOnly(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Strips any time component, keeping the UTC calendar day. */
export function toDateOnly(date: Date): Date {
  return dateOnly(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** "yyyy-MM-dd" from the UTC parts — the stable key for comparing dates. */
export function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Sat/Sun by UTC day-of-week. */
export function isWeekendDate(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Every calendar day in the month containing `anyDayInMonth`. */
export function monthDays(anyDayInMonth: Date): Date[] {
  const year = anyDayInMonth.getUTCFullYear();
  const month = anyDayInMonth.getUTCMonth();
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => dateOnly(year, month, i + 1));
}

/** Inclusive [first, last] date-only bounds of the month. */
export function monthBounds(anyDayInMonth: Date): { start: Date; end: Date } {
  const year = anyDayInMonth.getUTCFullYear();
  const month = anyDayInMonth.getUTCMonth();
  return {
    start: dateOnly(year, month, 1),
    end: new Date(Date.UTC(year, month + 1, 0)),
  };
}

/** Formats a date-only value without letting the local zone shift it. */
export function formatDateOnly(
  date: Date,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", weekday: "short" },
): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(date);
}
