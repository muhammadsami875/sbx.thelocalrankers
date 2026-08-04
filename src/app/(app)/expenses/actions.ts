"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma, notDeleted } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { requirePermission, PermissionError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { computePayroll, getEmployees, monthRange } from "@/lib/queries/hr";
import { expenseSchema, type ExpenseFormValues } from "@/lib/validations/expense";

export type ExpenseResult =
  | { ok: true; id: string; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const D = Prisma.Decimal;

/** `@db.Date` columns store the UTC calendar day — see lib/date-only.ts. */
function toDateOnly(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export async function createExpense(
  values: ExpenseFormValues,
): Promise<ExpenseResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "expenses:create");

    const parsed = expenseSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const d = parsed.data;
    const expense = await prisma.expense.create({
      data: {
        description: d.description,
        category: d.category,
        amount: new D(d.amount),
        currency: d.currency.toUpperCase(),
        incurredOn: toDateOnly(d.incurredOn),
        vendor: d.vendor || null,
        notes: d.notes || null,
        isRecurring: d.isRecurring,
        clientId: d.clientId || null,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
      select: { id: true },
    });

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Expense",
      entityId: expense.id,
      summary: `logged a ${d.category.toLowerCase()} expense of ${d.amount}`,
    });

    revalidateExpenses();
    return { ok: true, id: expense.id };
  } catch (error) {
    return handle(error);
  }
}

export async function updateExpense(
  id: string,
  values: ExpenseFormValues,
): Promise<ExpenseResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "expenses:update");

    const parsed = expenseSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const before = await prisma.expense.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, amount: true, description: true },
    });
    if (!before) return { ok: false, error: "That expense no longer exists." };

    const d = parsed.data;
    await prisma.expense.update({
      where: { id },
      data: {
        description: d.description,
        category: d.category,
        amount: new D(d.amount),
        currency: d.currency.toUpperCase(),
        incurredOn: toDateOnly(d.incurredOn),
        vendor: d.vendor || null,
        notes: d.notes || null,
        isRecurring: d.isRecurring,
        clientId: d.clientId || null,
        updatedById: session.user.id,
      },
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Expense",
      entityId: id,
      summary: `updated expense "${d.description}"`,
      before: { amount: Number(before.amount) },
      after: { amount: d.amount },
    });

    revalidateExpenses();
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

export async function deleteExpense(id: string): Promise<ExpenseResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "expenses:delete");

    const expense = await prisma.expense.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, description: true },
    });
    if (!expense) return { ok: false, error: "That expense no longer exists." };

    await prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: session.user.id },
    });

    await recordAudit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Expense",
      entityId: id,
      summary: `deleted expense "${expense.description}"`,
    });

    revalidateExpenses();
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

/**
 * Turns a month's payroll into expense rows so salaries and commission count
 * against profit.
 *
 * `payslipRef` is unique per employee+month, so re-running for the same month
 * updates the existing rows instead of double-counting.
 */
export async function postPayrollToExpenses(
  period?: string,
): Promise<ExpenseResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "expenses:create");

    const { start, key } = monthRange(period);
    const employees = await getEmployees();

    if (employees.length === 0) {
      return { ok: false, error: "There are no employees to post payroll for." };
    }

    // Salary lands on the last day of the month it was earned.
    const incurredOn = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    );

    let salaryTotal = 0;
    let commissionTotal = 0;
    let posted = 0;

    for (const employee of employees) {
      const payroll = await computePayroll(employee.id, period);
      if (!payroll.ok) continue;

      const { result } = payroll;
      const name = employee.user.name ?? employee.user.email ?? "Employee";

      const salaryNet = Number(result.baseSalary) - Number(result.absenceDeduction);
      const commission = Number(result.commissionTotal);

      if (salaryNet > 0) {
        await prisma.expense.upsert({
          where: { payslipRef: `salary:${employee.id}:${key}` },
          create: {
            description: `Salary — ${name} (${key})`,
            category: "SALARY",
            amount: new D(salaryNet),
            currency: employee.currency,
            incurredOn,
            employeeId: employee.id,
            payslipRef: `salary:${employee.id}:${key}`,
            createdById: session.user.id,
          },
          update: { amount: new D(salaryNet), updatedById: session.user.id },
        });
        salaryTotal += salaryNet;
        posted++;
      }

      if (commission > 0) {
        await prisma.expense.upsert({
          where: { payslipRef: `commission:${employee.id}:${key}` },
          create: {
            description: `Commission — ${name} (${key})`,
            category: "COMMISSION",
            amount: new D(commission),
            currency: employee.currency,
            incurredOn,
            employeeId: employee.id,
            payslipRef: `commission:${employee.id}:${key}`,
            createdById: session.user.id,
          },
          update: { amount: new D(commission), updatedById: session.user.id },
        });
        commissionTotal += commission;
        posted++;
      }
    }

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Expense",
      summary: `posted ${key} payroll to expenses (${posted} rows)`,
    });

    revalidateExpenses();
    return {
      ok: true,
      id: key,
      message:
        posted === 0
          ? "Nothing to post — no salary or commission for that month."
          : `Posted ${posted} payroll ${posted === 1 ? "row" : "rows"} for ${key}: salary ${Math.round(salaryTotal).toLocaleString()}, commission ${Math.round(commissionTotal).toLocaleString()}.`,
    };
  } catch (error) {
    return handle(error);
  }
}

function revalidateExpenses() {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

function handle(error: unknown): ExpenseResult {
  if (error instanceof PermissionError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, error: "Your session expired. Please sign in again." };
  }
  console.error("[expenses] action failed", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}
