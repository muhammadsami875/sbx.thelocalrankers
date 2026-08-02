/**
 * Seeds Abdul Wadood as a worked example of the HR module, then prints the
 * computed payroll so the arithmetic can be checked by eye.
 *
 *   npx tsx prisma/seed-abdul.ts
 *
 * Idempotent — re-running resets his attendance and sales for the month.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { dateOnly } from "../src/lib/date-only.js";
import {
  calculateCommission,
  calculatePayroll,
  convertAmount,
  formatMoney,
  type AttendanceDay,
} from "../src/lib/payroll.js";

const prisma = new PrismaClient();

const EMAIL = "abdul@thelocalrankers.com";
const PASSWORD = "LocalRankers!2026";
const BASE_SALARY = 50_000; // PKR
const COMMISSION_RATE = 6; // %
const FX = 278.5; // PKR per USD

async function main() {
  console.log("\n  Seeding Abdul Wadood...\n");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      name: "Abdul Wadood",
      email: EMAIL,
      passwordHash,
      role: "SOCIAL_MEDIA_TEAM",
      status: "ACTIVE",
      emailVerified: new Date(),
      jobTitle: "Cold Calling Agent",
      timezone: "Asia/Karachi",
    },
    update: { passwordHash, jobTitle: "Cold Calling Agent" },
    select: { id: true },
  });

  const employee = await prisma.employee.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      employeeNumber: "LR-012",
      designation: "Cold Calling Agent",
      department: "Sales",
      employmentType: "FULL_TIME",
      hireDate: new Date(2026, 0, 15),
      baseSalary: new Prisma.Decimal(BASE_SALARY),
      salary: new Prisma.Decimal(BASE_SALARY),
      currency: "PKR",
      commissionRate: new Prisma.Decimal(COMMISSION_RATE),
      shiftStart: "09:00",
      shiftEnd: "18:00",
    },
    update: {
      baseSalary: new Prisma.Decimal(BASE_SALARY),
      commissionRate: new Prisma.Decimal(COMMISSION_RATE),
      shiftStart: "09:00",
      shiftEnd: "18:00",
    },
    select: { id: true },
  });

  console.log(`  + user + employee record (LR-012)`);

  // ── Attendance for the current month ─────────────────────────────────
  // Seed the previous, complete month. Seeding the current one early in the
  // month produces a payslip where almost every day is still in the future.
  const now = new Date();
  const monthStart = dateOnly(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0));

  await prisma.attendance.deleteMany({
    where: { employeeId: employee.id, date: { gte: monthStart, lte: monthEnd } },
  });

  const weekdays: Date[] = [];
  for (let d = 1; d <= monthEnd.getUTCDate(); d++) {
    const day = dateOnly(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), d);
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) weekdays.push(day);
  }

  // The month is complete, so every weekday gets resolved.
  const elapsed = weekdays;

  let present = 0, late = 0, absent = 0;

  for (const [i, day] of elapsed.entries()) {
    // One absence and two late arrivals, to exercise every branch.
    const isAbsent = i === 3;
    const isLate = i === 1 || i === 6;
    if (isAbsent) {
      // Absence = simply no row. Payroll infers it from the missing record,
      // which is exactly how a real no-show behaves.
      absent++;
      continue;
    }

    const clockIn = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 9, isLate ? 27 : 0));
    const clockOut = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 18, 5));

    await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date: day,
        clockIn,
        clockOut,
        status: isLate ? "LATE" : "PRESENT",
        lateMinutes: isLate ? 27 : 0,
        minutesWorked: Math.round((clockOut.getTime() - clockIn.getTime()) / 60000),
      },
    });
    present++;
    if (isLate) late++;
  }

  console.log(`  + attendance: ${present} present (${late} late), ${absent} absent`);

  // ── Sales ────────────────────────────────────────────────────────────
  await prisma.sale.deleteMany({
    where: { employeeId: employee.id, saleDate: { gte: monthStart, lte: monthEnd } },
  });

  const deals = [
    { desc: "Local SEO retainer — Apex Window Cleaning", usd: 200 },
    { desc: "Google Ads setup — Riverside Plumbing", usd: 850 },
    { desc: "GBP management — Zenith Roofing", usd: 450 },
    { desc: "Web design deposit — Copperfield Landscaping", usd: 900 },
  ];

  for (const [i, deal] of deals.entries()) {
    const converted = convertAmount(deal.usd, FX);
    const saleDate = dateOnly(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), i * 5 + 2);
    await prisma.sale.create({
      data: {
        employeeId: employee.id,
        description: deal.desc,
        saleDate,
        amount: new Prisma.Decimal(deal.usd),
        currency: "USD",
        exchangeRate: new Prisma.Decimal(FX),
        amountConverted: converted,
        commissionRate: new Prisma.Decimal(COMMISSION_RATE),
        commissionAmount: calculateCommission(converted, COMMISSION_RATE),
        // Leave the last one pending, so the approval gate is visible.
        status: i === deals.length - 1 ? "PENDING" : "APPROVED",
        approvedAt: i === deals.length - 1 ? null : new Date(),
      },
    });
  }

  const totalUsd = deals.reduce((s, d) => s + d.usd, 0);
  console.log(`  + sales: ${deals.length} deals, $${totalUsd} (1 pending approval)`);

  // ── Show the computed payroll ────────────────────────────────────────
  const [attendance, approvedSales] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId: employee.id, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, status: true },
    }),
    prisma.sale.findMany({
      where: {
        employeeId: employee.id,
        status: { in: ["APPROVED", "PAID"] },
        saleDate: { gte: monthStart, lte: monthEnd },
      },
      select: { commissionAmount: true, amount: true },
    }),
  ]);

  const result = calculatePayroll({
    period: monthStart,
    baseSalary: BASE_SALARY,
    attendance: attendance as AttendanceDay[],
    commissions: approvedSales.map((s) => s.commissionAmount),
  });

  const approvedUsd = approvedSales.reduce((s, x) => s + Number(x.amount), 0);

  console.log("\n  ─────────────────────────────────────────────");
  console.log(`  PAYSLIP — ${monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`);
  console.log("  ─────────────────────────────────────────────");
  console.log(`   Working days (Mon–Fri)   ${result.workingDays}`);
  console.log(`   Present                  ${result.daysPresent}  (${result.lateCount} late)`);
  console.log(`   Absent                   ${result.daysAbsent}`);
  console.log("");
  console.log(`   Base salary              ${formatMoney(result.baseSalary, "PKR")}`);
  console.log(`   Per working day          ${formatMoney(result.perDayRate, "PKR")}`);
  console.log(`   Absence deduction       -${formatMoney(result.absenceDeduction, "PKR")}`);
  console.log("");
  console.log(`   Approved sales           $${approvedUsd} @ ${FX}`);
  console.log(`   Commission @ ${COMMISSION_RATE}%          +${formatMoney(result.commissionTotal, "PKR")}`);
  console.log("  ─────────────────────────────────────────────");
  console.log(`   NET PAY                  ${formatMoney(result.netPay, "PKR")}`);
  console.log("  ─────────────────────────────────────────────\n");

  console.log(`  Sign in as ${EMAIL} / ${PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error("\n  Failed:\n", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
