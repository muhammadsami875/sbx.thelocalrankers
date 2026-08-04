import { prisma, notDeleted } from "@/lib/prisma";
import { dateOnly, todayDateOnly } from "@/lib/date-only";
import {
  calculateCommission,
  calculatePayroll,
  type AttendanceDay,
  type PayrollResult,
} from "@/lib/payroll";

/**
 * Month boundaries for a "yyyy-MM" string, defaulting to the current month.
 *
 * Bounds are date-only (UTC midnight) because they are compared against
 * `@db.Date` columns — see lib/date-only.ts for why local dates are wrong.
 */
export function monthRange(period?: string) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    year = y!;
    month = m! - 1;
  }

  const start = dateOnly(year, month, 1);
  const end = new Date(Date.UTC(year, month + 1, 0));

  return { start, end, year, month, key: `${year}-${String(month + 1).padStart(2, "0")}` };
}

export async function getEmployeeForUser(userId: string) {
  return prisma.employee.findFirst({
    where: { userId, ...notDeleted },
    select: {
      id: true,
      employeeNumber: true,
      designation: true,
      department: true,
      baseSalary: true,
      currency: true,
      commissionRate: true,
      shiftStart: true,
      shiftEnd: true,
      workingDaysOverride: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}

/** Today's attendance row for an employee, if they've clocked in. */
export async function getTodayAttendance(employeeId: string) {
  const date = todayDateOnly();
  return prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
    select: {
      id: true,
      clockIn: true,
      clockOut: true,
      status: true,
      minutesWorked: true,
      lateMinutes: true,
    },
  });
}

export async function getHolidays(start: Date, end: Date) {
  const rows = await prisma.holiday.findMany({
    where: { ...notDeleted, date: { gte: start, lte: end } },
    select: { date: true, name: true },
    orderBy: { date: "asc" },
  });
  return rows;
}

export async function getAttendanceForMonth(employeeId: string, period?: string) {
  const { start, end } = monthRange(period);
  return prisma.attendance.findMany({
    where: { employeeId, ...notDeleted, date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      clockIn: true,
      clockOut: true,
      status: true,
      minutesWorked: true,
      lateMinutes: true,
      notes: true,
    },
  });
}

/**
 * Team-wide attendance summary for a month.
 *
 * Admins and managers often have no employee record of their own, so the
 * attendance page must still be useful to them — this is what it shows instead
 * of a dead end.
 */
export async function getTeamAttendance(period?: string) {
  const { start, end } = monthRange(period);

  const [employees, records, holidays] = await Promise.all([
    getEmployees(),
    prisma.attendance.findMany({
      where: { ...notDeleted, date: { gte: start, lte: end } },
      select: {
        employeeId: true,
        date: true,
        status: true,
        clockIn: true,
        clockOut: true,
        minutesWorked: true,
        lateMinutes: true,
      },
    }),
    prisma.holiday.findMany({
      where: { ...notDeleted, date: { gte: start, lte: end } },
      select: { date: true },
    }),
  ]);

  const today = todayDateOnly().getTime();
  const holidayDates = holidays.map((h) => h.date);

  return employees.map((employee) => {
    const mine = records.filter((r) => r.employeeId === employee.id);

    const summary = calculatePayroll({
      period: start,
      baseSalary: employee.baseSalary,
      attendance: mine as AttendanceDay[],
      holidays: holidayDates,
      workingDaysOverride: employee.workingDaysOverride,
    });

    const todayRecord = mine.find((r) => r.date.getTime() === today) ?? null;

    return {
      id: employee.id,
      name: employee.user.name ?? employee.user.email ?? "Unnamed",
      image: employee.user.image,
      designation: employee.designation,
      shiftStart: employee.shiftStart,
      shiftEnd: employee.shiftEnd,
      currency: employee.currency,
      workingDays: summary.workingDays,
      daysPresent: summary.daysPresent,
      daysAbsent: summary.daysAbsent,
      daysLeave: summary.daysLeave,
      lateCount: summary.lateCount,
      minutesWorked: mine.reduce((s, r) => s + (r.minutesWorked ?? 0), 0),
      absenceDeduction: Number(summary.absenceDeduction),
      todayStatus: todayRecord?.status ?? null,
      todayClockIn: todayRecord?.clockIn ?? null,
      todayClockOut: todayRecord?.clockOut ?? null,
    };
  });
}

export type TeamAttendanceRow = Awaited<
  ReturnType<typeof getTeamAttendance>
>[number];

export async function getEmployees() {
  const rows = await prisma.employee.findMany({
    where: notDeleted,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      employeeNumber: true,
      designation: true,
      department: true,
      employmentType: true,
      baseSalary: true,
      currency: true,
      commissionRate: true,
      shiftStart: true,
      shiftEnd: true,
      hireDate: true,
      // Needed by getTeamAttendance so its working-day counts match payroll.
      workingDaysOverride: true,
      user: {
        select: { id: true, name: true, email: true, image: true, role: true, status: true },
      },
    },
  });

  return rows.map((r) => ({
    ...r,
    baseSalary: r.baseSalary ? Number(r.baseSalary) : 0,
    commissionRate: Number(r.commissionRate),
  }));
}

export type EmployeeRow = Awaited<ReturnType<typeof getEmployees>>[number];

export async function getSales(opts: {
  employeeId?: string;
  period?: string;
  limit?: number;
}) {
  const { start, end } = monthRange(opts.period);

  const rows = await prisma.sale.findMany({
    where: {
      ...notDeleted,
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
      saleDate: { gte: start, lte: end },
    },
    orderBy: { saleDate: "desc" },
    take: opts.limit ?? 100,
    select: {
      id: true,
      description: true,
      saleDate: true,
      amount: true,
      currency: true,
      exchangeRate: true,
      amountConverted: true,
      commissionRate: true,
      commissionAmount: true,
      status: true,
      employee: {
        select: { id: true, user: { select: { name: true } } },
      },
    },
  });

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    exchangeRate: Number(r.exchangeRate),
    amountConverted: Number(r.amountConverted),
    commissionRate: Number(r.commissionRate),
    commissionAmount: Number(r.commissionAmount),
  }));
}

export type SaleRow = Awaited<ReturnType<typeof getSales>>[number];

/**
 * Computes a payslip for one employee and month without persisting it.
 * Used to preview payroll before it is approved and frozen.
 */
export async function computePayroll(
  employeeId: string,
  period?: string,
): Promise<
  | { ok: false; reason: string }
  | {
      ok: true;
      employee: NonNullable<Awaited<ReturnType<typeof getEmployeeById>>>;
      result: PayrollResult;
      salesTotal: number;
      salesCount: number;
      periodKey: string;
    }
> {
  const employee = await getEmployeeById(employeeId);
  if (!employee) return { ok: false, reason: "Employee not found." };

  const { start, end, key } = monthRange(period);

  const [attendance, holidays, sales] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId, ...notDeleted, date: { gte: start, lte: end } },
      select: { date: true, status: true },
    }),
    prisma.holiday.findMany({
      where: { ...notDeleted, date: { gte: start, lte: end } },
      select: { date: true },
    }),
    // Only APPROVED and PAID sales earn commission — PENDING is not yet owed.
    prisma.sale.findMany({
      where: {
        employeeId,
        ...notDeleted,
        status: { in: ["APPROVED", "PAID"] },
        saleDate: { gte: start, lte: end },
      },
      select: { amountConverted: true, commissionAmount: true },
    }),
  ]);

  const result = calculatePayroll({
    period: start,
    baseSalary: employee.baseSalary ?? 0,
    attendance: attendance as AttendanceDay[],
    holidays: holidays.map((h) => h.date),
    commissions: sales.map((s) => s.commissionAmount),
    workingDaysOverride: employee.workingDaysOverride,
  });

  return {
    ok: true,
    employee,
    result,
    salesTotal: sales.reduce((sum, s) => sum + Number(s.amountConverted), 0),
    salesCount: sales.length,
    periodKey: key,
  };
}

export async function getEmployeeById(id: string) {
  return prisma.employee.findFirst({
    where: { id, ...notDeleted },
    select: {
      id: true,
      employeeNumber: true,
      designation: true,
      department: true,
      baseSalary: true,
      currency: true,
      commissionRate: true,
      shiftStart: true,
      shiftEnd: true,
      workingDaysOverride: true,
      hireDate: true,
      user: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
  });
}

/** Re-exported so pages can compute commission without importing payroll directly. */
export { calculateCommission };
