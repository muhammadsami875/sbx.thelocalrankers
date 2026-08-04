"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { prisma, notDeleted } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { requirePermission, PermissionError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { nextInvoiceNumber } from "@/lib/queries/billing";
import {
  invoiceSchema,
  invoiceTotals,
  paymentSchema,
  subscriptionSchema,
  type InvoiceFormValues,
  type PaymentFormValues,
  type SubscriptionFormValues,
} from "@/lib/validations/billing";

export type BillingResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const D = Prisma.Decimal;

function toDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

// ── Invoices ────────────────────────────────────────────────────────────────

export async function createInvoice(
  values: InvoiceFormValues,
): Promise<BillingResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "invoices:create");

    const parsed = invoiceSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const d = parsed.data;
    const items = d.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    }));
    const totals = invoiceTotals(items, d.taxRate, d.discount);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: await nextInvoiceNumber(),
        clientId: d.clientId,
        status: d.status,
        issueDate: toDate(d.issueDate),
        dueDate: toDate(d.dueDate),
        sentAt: d.status === "DRAFT" ? null : new Date(),
        subtotal: new D(totals.subtotal),
        taxRate: new D(d.taxRate),
        taxAmount: new D(totals.taxAmount),
        discount: new D(d.discount),
        total: new D(totals.total),
        amountPaid: new D(0),
        notes: d.notes || null,
        terms: d.terms || null,
        createdById: session.user.id,
        updatedById: session.user.id,
        items: {
          create: items.map((i, idx) => ({
            description: i.description,
            quantity: new D(i.quantity),
            unitPrice: new D(i.unitPrice),
            amount: new D(i.quantity * i.unitPrice),
            service: i.service || null,
            position: idx,
          })),
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      summary: `created invoice ${invoice.invoiceNumber} for ${totals.total}`,
    });

    revalidateBilling();
    return { ok: true, id: invoice.id };
  } catch (error) {
    return handle(error);
  }
}

export async function updateInvoice(
  id: string,
  values: InvoiceFormValues,
): Promise<BillingResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "invoices:update");

    const parsed = invoiceSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const before = await prisma.invoice.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, invoiceNumber: true, amountPaid: true, total: true },
    });
    if (!before) return { ok: false, error: "That invoice no longer exists." };

    const d = parsed.data;
    const items = d.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    }));
    const totals = invoiceTotals(items, d.taxRate, d.discount);

    // Editing an invoice below what has already been collected would leave a
    // negative balance and a payment history that no longer reconciles.
    const paid = Number(before.amountPaid);
    if (paid > 0 && totals.total < paid) {
      return {
        ok: false,
        error: `This invoice already has ${paid.toLocaleString()} recorded against it. The new total can't be lower than that.`,
      };
    }

    await prisma.invoice.update({
      where: { id },
      data: {
        clientId: d.clientId,
        status: resolveStatus(d.status, totals.total, paid),
        issueDate: toDate(d.issueDate),
        dueDate: toDate(d.dueDate),
        subtotal: new D(totals.subtotal),
        taxRate: new D(d.taxRate),
        taxAmount: new D(totals.taxAmount),
        discount: new D(d.discount),
        total: new D(totals.total),
        notes: d.notes || null,
        terms: d.terms || null,
        updatedById: session.user.id,
        // Replacing the lines wholesale is simpler and safer than diffing.
        items: {
          deleteMany: {},
          create: items.map((i, idx) => ({
            description: i.description,
            quantity: new D(i.quantity),
            unitPrice: new D(i.unitPrice),
            amount: new D(i.quantity * i.unitPrice),
            service: i.service || null,
            position: idx,
          })),
        },
      },
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Invoice",
      entityId: id,
      summary: `updated invoice ${before.invoiceNumber}`,
      before: { total: Number(before.total) },
      after: { total: totals.total },
    });

    revalidateBilling();
    revalidatePath(`/invoices/${id}`);
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

export async function setInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<BillingResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "invoices:update");

    const invoice = await prisma.invoice.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, invoiceNumber: true, total: true, amountPaid: true },
    });
    if (!invoice) return { ok: false, error: "That invoice no longer exists." };

    await prisma.invoice.update({
      where: { id },
      data: {
        status,
        sentAt: status === "SENT" ? new Date() : undefined,
        paidAt:
          status === "PAID" ? new Date() : status === "VOID" ? null : undefined,
        // Marking paid by hand settles the balance so the two never disagree.
        amountPaid: status === "PAID" ? invoice.total : undefined,
      },
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Invoice",
      entityId: id,
      summary: `marked invoice ${invoice.invoiceNumber} as ${status.toLowerCase().replace(/_/g, " ")}`,
    });

    revalidateBilling();
    revalidatePath(`/invoices/${id}`);
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

export async function deleteInvoice(id: string): Promise<BillingResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "invoices:delete");

    const invoice = await prisma.invoice.findFirst({
      where: { id, ...notDeleted },
      select: {
        id: true,
        invoiceNumber: true,
        _count: { select: { payments: { where: { deletedAt: null } } } },
      },
    });
    if (!invoice) return { ok: false, error: "That invoice no longer exists." };

    if (invoice._count.payments > 0) {
      return {
        ok: false,
        error:
          "This invoice has payments recorded against it. Void it instead so the payment history stays intact.",
      };
    }

    await prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: session.user.id },
    });

    await recordAudit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Invoice",
      entityId: id,
      summary: `deleted invoice ${invoice.invoiceNumber}`,
    });

    revalidateBilling();
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

// ── Payments ────────────────────────────────────────────────────────────────

/**
 * Records a payment and re-derives the invoice's status from the new balance,
 * inside one transaction so the two can never drift apart.
 */
export async function recordPayment(
  values: PaymentFormValues,
): Promise<BillingResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "payments:create");

    const parsed = paymentSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const d = parsed.data;

    const invoice = await prisma.invoice.findFirst({
      where: { id: d.invoiceId, ...notDeleted },
      select: { id: true, invoiceNumber: true, total: true, amountPaid: true },
    });
    if (!invoice) return { ok: false, error: "That invoice no longer exists." };

    const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
    if (d.amount > outstanding + 0.01) {
      return {
        ok: false,
        error: `That's more than the ${outstanding.toLocaleString()} outstanding on this invoice.`,
        fieldErrors: { amount: ["Exceeds the outstanding balance"] },
      };
    }

    const newPaid = Number(invoice.amountPaid) + d.amount;
    const settled = newPaid >= Number(invoice.total) - 0.01;

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: d.invoiceId,
          amount: new D(d.amount),
          method: d.method,
          status: "SUCCEEDED",
          paidAt: toDate(d.paidAt),
          reference: d.reference || null,
          createdById: session.user.id,
        },
        select: { id: true },
      });

      await tx.invoice.update({
        where: { id: d.invoiceId },
        data: {
          amountPaid: new D(newPaid),
          status: settled ? "PAID" : "PARTIALLY_PAID",
          paidAt: settled ? toDate(d.paidAt) : null,
        },
      });

      return created;
    });

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Payment",
      entityId: payment.id,
      summary: `recorded ${d.amount} against invoice ${invoice.invoiceNumber}`,
    });

    revalidateBilling();
    revalidatePath(`/invoices/${d.invoiceId}`);
    return { ok: true, id: payment.id };
  } catch (error) {
    return handle(error);
  }
}

/** Reverses a payment and rolls the invoice balance back. */
export async function deletePayment(id: string): Promise<BillingResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "payments:delete");

    const payment = await prisma.payment.findFirst({
      where: { id, ...notDeleted },
      select: {
        id: true,
        amount: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            amountPaid: true,
            dueDate: true,
          },
        },
      },
    });
    if (!payment) return { ok: false, error: "That payment no longer exists." };

    const newPaid = Math.max(
      0,
      Number(payment.invoice.amountPaid) - Number(payment.amount),
    );
    const overdue = payment.invoice.dueDate < new Date();

    await prisma.$transaction([
      prisma.payment.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.invoice.update({
        where: { id: payment.invoice.id },
        data: {
          amountPaid: new D(newPaid),
          status:
            newPaid <= 0 ? (overdue ? "OVERDUE" : "SENT") : "PARTIALLY_PAID",
          paidAt: null,
        },
      }),
    ]);

    await recordAudit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Payment",
      entityId: id,
      summary: `reversed a payment on invoice ${payment.invoice.invoiceNumber}`,
    });

    revalidateBilling();
    revalidatePath(`/invoices/${payment.invoice.id}`);
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

// ── Subscriptions (retainers / packages) ────────────────────────────────────

export async function upsertSubscription(
  values: SubscriptionFormValues,
  id?: string,
): Promise<BillingResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "subscriptions:update");

    const parsed = subscriptionSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const d = parsed.data;
    const start = toDate(d.startDate);
    const periodEnd = new Date(start);
    periodEnd.setMonth(periodEnd.getMonth() + 1, 0);

    const payload = {
      clientId: d.clientId,
      name: d.name,
      amount: new D(d.amount),
      interval: d.interval,
      status: d.status,
      startDate: start,
      currentPeriodStart: start,
      currentPeriodEnd: periodEnd,
      nextInvoiceDate: d.nextInvoiceDate ? toDate(d.nextInvoiceDate) : null,
      autoRenew: d.autoRenew,
      updatedById: session.user.id,
    };

    const sub = id
      ? await prisma.subscription.update({
          where: { id },
          data: payload,
          select: { id: true, name: true },
        })
      : await prisma.subscription.create({
          data: { ...payload, createdById: session.user.id },
          select: { id: true, name: true },
        });

    // The client's headline retainer should track its active monthly package.
    if (d.status === "ACTIVE" && d.interval === "MONTHLY") {
      await prisma.client.update({
        where: { id: d.clientId },
        data: { monthlyRetainer: new D(d.amount) },
      });
    }

    await recordAudit({
      userId: session.user.id,
      action: id ? "UPDATE" : "CREATE",
      entity: "Subscription",
      entityId: sub.id,
      summary: `${id ? "updated" : "created"} package "${sub.name}"`,
    });

    revalidateBilling();
    revalidatePath(`/clients/${d.clientId}`);
    return { ok: true, id: sub.id };
  } catch (error) {
    return handle(error);
  }
}

export async function cancelSubscription(id: string): Promise<BillingResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "subscriptions:update");

    const sub = await prisma.subscription.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, name: true, clientId: true },
    });
    if (!sub) return { ok: false, error: "That package no longer exists." };

    await prisma.subscription.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), autoRenew: false },
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Subscription",
      entityId: id,
      summary: `cancelled package "${sub.name}"`,
    });

    revalidateBilling();
    revalidatePath(`/clients/${sub.clientId}`);
    return { ok: true, id };
  } catch (error) {
    return handle(error);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Keeps the stored status honest about how much has actually been paid. */
function resolveStatus(
  requested: InvoiceStatus,
  total: number,
  paid: number,
): InvoiceStatus {
  if (paid <= 0) return requested;
  if (paid >= total - 0.01) return "PAID";
  return "PARTIALLY_PAID";
}

function revalidateBilling() {
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
}

function handle(error: unknown): BillingResult {
  if (error instanceof PermissionError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, error: "Your session expired. Please sign in again." };
  }
  console.error("[billing] action failed", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}
