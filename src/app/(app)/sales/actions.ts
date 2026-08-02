"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma, notDeleted } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { can, requirePermission, PermissionError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { calculateCommission, convertAmount } from "@/lib/payroll";
import { saleSchema, type SaleFormValues } from "@/lib/validations/hr";

export type SaleResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Logs a closed deal for the signed-in employee.
 *
 * The amount is stored as sold (usually USD) AND converted to the employee's
 * payroll currency using the rate supplied at entry. Both the rate and the
 * commission percentage are frozen on the row, so later FX moves or a change
 * to the employee's commission rate never rewrite past earnings.
 */
export async function createSale(values: SaleFormValues): Promise<SaleResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "sales:create");

    const parsed = saleSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id, ...notDeleted },
      select: { id: true, commissionRate: true },
    });
    if (!employee) {
      return {
        ok: false,
        error: "No employee record is linked to your account. Ask an admin to set one up.",
      };
    }

    const { amount, exchangeRate, description, saleDate, currency, clientId } =
      parsed.data;

    const amountConverted = convertAmount(amount, exchangeRate);
    const commissionAmount = calculateCommission(
      amountConverted,
      employee.commissionRate,
    );

    const sale = await prisma.sale.create({
      data: {
        employeeId: employee.id,
        clientId: clientId || null,
        description,
        saleDate: new Date(`${saleDate}T00:00:00`),
        amount: new Prisma.Decimal(amount),
        currency,
        exchangeRate: new Prisma.Decimal(exchangeRate),
        amountConverted,
        commissionRate: employee.commissionRate,
        commissionAmount,
        status: "PENDING",
        createdById: session.user.id,
      },
      select: { id: true },
    });

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Sale",
      entityId: sale.id,
      summary: `logged a ${currency} ${amount} sale — ${description}`,
    });

    revalidatePath("/sales");
    revalidatePath("/payroll");
    return { ok: true, id: sale.id };
  } catch (error) {
    return handle(error);
  }
}

/** Approve/reject a logged sale. Only APPROVED and PAID earn commission. */
export async function setSaleStatus(
  id: string,
  status: "APPROVED" | "REJECTED" | "PENDING" | "PAID",
): Promise<SaleResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "sales:update");

    const sale = await prisma.sale.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, description: true, payslipId: true },
    });
    if (!sale) return { ok: false, error: "That sale no longer exists." };

    // Once rolled into a payslip the amount has been paid out; reopening it
    // would silently change a figure the employee has already been given.
    if (sale.payslipId && status !== "PAID") {
      return {
        ok: false,
        error: "This sale is already included in an issued payslip and can't be changed.",
      };
    }

    await prisma.sale.update({
      where: { id },
      data: {
        status,
        approvedById: status === "APPROVED" ? session.user.id : null,
        approvedAt: status === "APPROVED" ? new Date() : null,
      },
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Sale",
      entityId: id,
      summary: `marked sale "${sale.description}" as ${status.toLowerCase()}`,
    });

    revalidatePath("/sales");
    revalidatePath("/payroll");
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

export async function deleteSale(id: string): Promise<SaleResult> {
  try {
    const session = await requireSession();

    const sale = await prisma.sale.findFirst({
      where: { id, ...notDeleted },
      select: {
        id: true,
        description: true,
        payslipId: true,
        employee: { select: { userId: true } },
      },
    });
    if (!sale) return { ok: false, error: "That sale no longer exists." };

    // You may always remove your own un-paid entry; removing someone else's
    // needs the delete permission.
    const isOwn = sale.employee.userId === session.user.id;
    if (!isOwn) requirePermission(session.user.role, "sales:delete");

    if (sale.payslipId) {
      return {
        ok: false,
        error: "This sale is part of an issued payslip and can't be deleted.",
      };
    }

    await prisma.sale.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await recordAudit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Sale",
      entityId: id,
      summary: `removed sale "${sale.description}"`,
    });

    revalidatePath("/sales");
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

function handle(error: unknown): SaleResult {
  if (error instanceof PermissionError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, error: "Your session expired. Please sign in again." };
  }
  console.error("[sales] action failed", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}
