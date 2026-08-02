import { Prisma, type AttendanceStatus } from "@prisma/client";
import {
  dateKey,
  isWeekendDate,
  monthDays,
} from "@/lib/date-only";

/**
 * Payroll calculation.
 *
 * Pure functions only — no database access — so the arithmetic can be tested
 * directly and reasoned about in isolation.
 *
 * Rules (confirmed with the agency):
 *   · Working days = Mon–Fri in the month, minus company holidays.
 *   · Per-day rate = base salary ÷ working days, recomputed each month, so a
 *     21-weekday month costs more per absent day than a 22-weekday one.
 *   · Only ABSENT (a working day with no clock-in) deducts pay.
 *     LATE is flagged but never deducted.
 *     ON_LEAVE is paid unless `deductApprovedLeave` is enabled.
 *   · Commission is a percent of the sale value converted to payroll currency,
 *     using the rate frozen on the Sale row at entry.
 *
 * Money uses Prisma.Decimal throughout. Currency must never touch JS floats:
 * 50000/21 in binary floating point does not round-trip, and the error
 * compounds across a payroll run.
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/** Rounds to 2dp, half-up — the convention payroll statements expect. */
export function money(value: Decimal | number | string): Decimal {
  return new D(value).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

export type PayrollPolicy = {
  /** When true, approved leave deducts a day just like an absence. */
  deductApprovedLeave: boolean;
  /** Fraction of a day deducted for a HALF_DAY record. */
  halfDayFraction: number;
};

export const DEFAULT_POLICY: PayrollPolicy = {
  deductApprovedLeave: false,
  halfDayFraction: 0.5,
};

/**
 * Sat/Sun. Attendance dates come from `@db.Date` columns, which Prisma hands
 * back at UTC midnight — so the UTC accessors are the correct ones. Using
 * getDay() here would shift the weekday by one in any non-UTC zone.
 */
export const isWeekend = isWeekendDate;

const toKey = dateKey;

/** Every calendar day in the month containing `anyDayInMonth`. */
export const daysInMonth = monthDays;

/**
 * Working days = weekdays minus holidays that fall on a weekday.
 * A holiday landing on a Saturday does not add a day back.
 */
export function countWorkingDays(
  anyDayInMonth: Date,
  holidays: Date[] = [],
): number {
  const holidaySet = new Set(holidays.map(toKey));
  return daysInMonth(anyDayInMonth).filter(
    (d) => !isWeekend(d) && !holidaySet.has(toKey(d)),
  ).length;
}

export type AttendanceDay = {
  date: Date;
  status: AttendanceStatus;
};

export type PayrollInput = {
  /** Any date inside the month being paid. */
  period: Date;
  baseSalary: Decimal | number | string;
  /** Attendance rows that exist for this employee in this month. */
  attendance: AttendanceDay[];
  holidays?: Date[];
  /** Sale commission amounts, already in payroll currency. */
  commissions?: Array<Decimal | number | string>;
  bonus?: Decimal | number | string;
  otherDeductions?: Decimal | number | string;
  /** Overrides the calendar-derived working-day count. */
  workingDaysOverride?: number | null;
  policy?: PayrollPolicy;
};

export type PayrollResult = {
  workingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  daysHoliday: number;
  lateCount: number;
  /** Days actually deducted, including half-days — can be fractional. */
  deductedDays: number;
  baseSalary: Decimal;
  perDayRate: Decimal;
  absenceDeduction: Decimal;
  otherDeductions: Decimal;
  commissionTotal: Decimal;
  bonus: Decimal;
  netPay: Decimal;
};

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const policy = input.policy ?? DEFAULT_POLICY;
  const baseSalary = money(input.baseSalary);

  const workingDays =
    input.workingDaysOverride && input.workingDaysOverride > 0
      ? input.workingDaysOverride
      : countWorkingDays(input.period, input.holidays ?? []);

  // Guard against dividing by zero in a month that is entirely holidays.
  const perDayRate =
    workingDays > 0
      ? money(baseSalary.dividedBy(workingDays))
      : new D(0);

  // Index the attendance we have, then resolve the whole month. Days with no
  // record that are working days count as absent — that is the core rule.
  const byDate = new Map(input.attendance.map((a) => [toKey(a.date), a.status]));
  const holidaySet = new Set((input.holidays ?? []).map(toKey));

  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLeave = 0;
  let daysHoliday = 0;
  let lateCount = 0;
  let deductedDays = 0;

  for (const day of daysInMonth(input.period)) {
    const key = toKey(day);
    const weekend = isWeekend(day);
    const holiday = holidaySet.has(key);
    const status = byDate.get(key);

    if (holiday && !weekend) daysHoliday++;

    // Non-working days never affect pay, even if someone clocked in.
    if (weekend || holiday) {
      if (status === "PRESENT" || status === "LATE") daysPresent++;
      continue;
    }

    switch (status) {
      case "PRESENT":
        daysPresent++;
        break;
      case "LATE":
        // Flagged for reporting; deliberately not deducted.
        daysPresent++;
        lateCount++;
        break;
      case "HALF_DAY":
        daysPresent++;
        deductedDays += policy.halfDayFraction;
        break;
      case "ON_LEAVE":
        daysLeave++;
        if (policy.deductApprovedLeave) deductedDays += 1;
        break;
      case "ABSENT":
        daysAbsent++;
        deductedDays += 1;
        break;
      default:
        // No record on a working day — a no-show.
        daysAbsent++;
        deductedDays += 1;
        break;
    }
  }

  // Derive the deduction from the UNROUNDED ratio, not from perDayRate.
  // perDayRate is rounded for display, and rounding first then multiplying
  // accumulates error: 50000/22 → 2272.73, ×22 = 50000.06, which would push
  // a fully-absent month to negative pay. Rounding once at the end avoids it.
  // Clamped to the base salary so a deduction can never create a debt.
  const rawDeduction =
    workingDays > 0
      ? baseSalary.times(deductedDays).dividedBy(workingDays)
      : new D(0);
  const absenceDeduction = money(
    rawDeduction.greaterThan(baseSalary) ? baseSalary : rawDeduction,
  );

  const commissionTotal = (input.commissions ?? []).reduce<Decimal>(
    (sum, c) => sum.plus(new D(c)),
    new D(0),
  );

  const bonus = money(input.bonus ?? 0);
  const otherDeductions = money(input.otherDeductions ?? 0);

  const netPay = money(
    baseSalary
      .minus(absenceDeduction)
      .minus(otherDeductions)
      .plus(money(commissionTotal))
      .plus(bonus),
  );

  return {
    workingDays,
    daysPresent,
    daysAbsent,
    daysLeave,
    daysHoliday,
    lateCount,
    deductedDays,
    baseSalary,
    perDayRate,
    absenceDeduction,
    otherDeductions,
    commissionTotal: money(commissionTotal),
    bonus,
    netPay,
  };
}

/** Commission on a sale, in payroll currency. */
export function calculateCommission(
  amountConverted: Decimal | number | string,
  commissionRatePercent: Decimal | number | string,
): Decimal {
  return money(new D(amountConverted).times(new D(commissionRatePercent)).dividedBy(100));
}

/** Sale value converted to payroll currency at the given rate. */
export function convertAmount(
  amount: Decimal | number | string,
  exchangeRate: Decimal | number | string,
): Decimal {
  return money(new D(amount).times(new D(exchangeRate)));
}

/**
 * Decides PRESENT vs LATE from a clock-in against an "HH:mm" shift start.
 * `graceMinutes` absorbs a few minutes of clock drift without flagging.
 */
export function resolveClockInStatus(
  clockIn: Date,
  shiftStart: string,
  graceMinutes = 0,
): { status: Extract<AttendanceStatus, "PRESENT" | "LATE">; lateMinutes: number } {
  const [h, m] = shiftStart.split(":").map(Number);
  const start = new Date(clockIn);
  start.setHours(h ?? 9, m ?? 0, 0, 0);

  const diffMs = clockIn.getTime() - start.getTime();
  const lateMinutes = Math.max(0, Math.round(diffMs / 60_000));

  return lateMinutes > graceMinutes
    ? { status: "LATE", lateMinutes }
    : { status: "PRESENT", lateMinutes: 0 };
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

/** "8h 15m" */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Currency formatter that respects the employee's payroll currency. */
export function formatMoney(
  amount: Decimal | number | string | null | undefined,
  currency = "PKR",
): string {
  const value = amount == null ? 0 : Number(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}
