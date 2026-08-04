import { ExpenseCategory, type Prisma } from "@prisma/client";
import { prisma, notDeleted } from "@/lib/prisma";
import { dateOnly } from "@/lib/date-only";

/** Month bounds as date-only values, matching the `@db.Date` column. */
export function expenseMonthRange(period?: string) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    year = y!;
    month = m! - 1;
  }

  return {
    start: dateOnly(year, month, 1),
    end: new Date(Date.UTC(year, month + 1, 0)),
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}

export async function getExpenses(opts: {
  period?: string;
  category?: ExpenseCategory;
  clientId?: string;
}) {
  const { start, end } = expenseMonthRange(opts.period);

  const where: Prisma.ExpenseWhereInput = {
    ...notDeleted,
    incurredOn: { gte: start, lte: end },
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.clientId ? { clientId: opts.clientId } : {}),
  };

  const rows = await prisma.expense.findMany({
    where,
    orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      description: true,
      category: true,
      amount: true,
      currency: true,
      incurredOn: true,
      vendor: true,
      notes: true,
      isRecurring: true,
      clientId: true,
      employeeId: true,
      payslipRef: true,
    },
  });

  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export type ExpenseRow = Awaited<ReturnType<typeof getExpenses>>[number];

/** Totals for a month, plus a per-category breakdown for the summary tiles. */
export async function getExpenseSummary(period?: string) {
  const { start, end } = expenseMonthRange(period);

  const [total, byCategory] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { ...notDeleted, incurredOn: { gte: start, lte: end } },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      where: { ...notDeleted, incurredOn: { gte: start, lte: end } },
    }),
  ]);

  const categories = Object.fromEntries(
    byCategory.map((c) => [c.category, Number(c._sum.amount ?? 0)]),
  ) as Record<ExpenseCategory, number>;

  return {
    total: Number(total._sum.amount ?? 0),
    count: total._count,
    categories,
    payrollTotal:
      (categories.SALARY ?? 0) + (categories.COMMISSION ?? 0),
  };
}

/** Total expenses in an arbitrary window — used by the dashboard P&L. */
export async function getExpenseTotal(start: Date, end: Date) {
  const agg = await prisma.expense.aggregate({
    _sum: { amount: true },
    where: { ...notDeleted, incurredOn: { gte: start, lte: end } },
  });
  return Number(agg._sum.amount ?? 0);
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SALARY: "Salary",
  COMMISSION: "Commission",
  CONTRACTOR: "Contractor",
  SOFTWARE: "Software",
  ADVERTISING: "Advertising",
  OFFICE: "Office",
  TRAVEL: "Travel",
  EQUIPMENT: "Equipment",
  TAX: "Tax",
  BANK_FEES: "Bank fees",
  OTHER: "Other",
};

export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);
