import type { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma, notDeleted } from "@/lib/prisma";
import { INTERVAL_MONTHS } from "@/lib/validations/billing";

export async function getInvoices(opts: {
  clientId?: string;
  status?: InvoiceStatus;
  q?: string;
  limit?: number;
}) {
  const where: Prisma.InvoiceWhereInput = {
    ...notDeleted,
    ...(opts.clientId ? { clientId: opts.clientId } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q
      ? {
          OR: [
            { invoiceNumber: { contains: opts.q, mode: "insensitive" } },
            { client: { companyName: { contains: opts.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.invoice.findMany({
    where,
    orderBy: [{ issueDate: "desc" }, { invoiceNumber: "desc" }],
    take: opts.limit ?? 200,
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      issueDate: true,
      dueDate: true,
      paidAt: true,
      subtotal: true,
      taxRate: true,
      taxAmount: true,
      discount: true,
      total: true,
      amountPaid: true,
      currency: true,
      client: { select: { id: true, companyName: true } },
      _count: { select: { items: true, payments: true } },
    },
  });

  return rows.map(toPlainInvoice);
}

function toPlainInvoice<
  T extends {
    subtotal: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
    amountPaid: Prisma.Decimal;
  },
>(row: T) {
  return {
    ...row,
    subtotal: Number(row.subtotal),
    taxRate: Number(row.taxRate),
    taxAmount: Number(row.taxAmount),
    discount: Number(row.discount),
    total: Number(row.total),
    amountPaid: Number(row.amountPaid),
    // Precomputed so tables never re-derive it inconsistently.
    outstanding: Number(row.total) - Number(row.amountPaid),
  };
}

export type InvoiceRow = Awaited<ReturnType<typeof getInvoices>>[number];

export async function getInvoiceById(id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...notDeleted },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          email: true,
          addressLine1: true,
          city: true,
          state: true,
          zipCode: true,
        },
      },
      items: { orderBy: { position: "asc" } },
      payments: {
        where: notDeleted,
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          paidAt: true,
          reference: true,
        },
      },
    },
  });

  if (!invoice) return null;

  return {
    ...toPlainInvoice(invoice),
    items: invoice.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      amount: Number(i.amount),
    })),
    payments: invoice.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };
}

export type InvoiceDetail = NonNullable<
  Awaited<ReturnType<typeof getInvoiceById>>
>;

export async function getPayments(opts: { clientId?: string; limit?: number }) {
  const rows = await prisma.payment.findMany({
    where: {
      ...notDeleted,
      ...(opts.clientId ? { invoice: { clientId: opts.clientId } } : {}),
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 200,
    select: {
      id: true,
      amount: true,
      method: true,
      status: true,
      paidAt: true,
      reference: true,
      createdAt: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          client: { select: { id: true, companyName: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    invoice: { ...r.invoice, total: Number(r.invoice.total) },
  }));
}

export type PaymentRow = Awaited<ReturnType<typeof getPayments>>[number];

export async function getSubscriptions(clientId?: string) {
  const rows = await prisma.subscription.findMany({
    where: { ...notDeleted, ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      interval: true,
      amount: true,
      startDate: true,
      currentPeriodEnd: true,
      nextInvoiceDate: true,
      autoRenew: true,
      client: { select: { id: true, companyName: true } },
    },
  });

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    /** Normalised to a monthly figure so MRR sums correctly across intervals. */
    monthlyValue: Number(r.amount) / INTERVAL_MONTHS[r.interval],
  }));
}

export type SubscriptionRow = Awaited<ReturnType<typeof getSubscriptions>>[number];

export type OpenInvoiceLite = Awaited<ReturnType<typeof getOpenInvoices>>[number];

/**
 * Clients for the invoice form's picker.
 *
 * Decimal is converted to a plain number here: Prisma.Decimal is a class
 * instance and React cannot serialize it across the server→client boundary.
 */
export async function getClientOptions() {
  const rows = await prisma.client.findMany({
    where: { ...notDeleted, status: { notIn: ["CHURNED"] } },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true, monthlyRetainer: true },
  });

  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    monthlyRetainer: r.monthlyRetainer ? Number(r.monthlyRetainer) : null,
  }));
}

export type ClientOption = Awaited<ReturnType<typeof getClientOptions>>[number];

/** Open invoices a payment can be recorded against. */
export async function getOpenInvoices() {
  const rows = await prisma.invoice.findMany({
    where: {
      ...notDeleted,
      status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      amountPaid: true,
      dueDate: true,
      client: { select: { companyName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    dueDate: r.dueDate,
    clientName: r.client.companyName,
    outstanding: Number(r.total) - Number(r.amountPaid),
  }));
}

/** Headline figures for the invoices and payments pages. */
export async function getBillingSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [open, overdue, collectedThisMonth, subs] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true, amountPaid: true },
      _count: true,
      where: {
        ...notDeleted,
        status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true, amountPaid: true },
      _count: true,
      where: { ...notDeleted, status: "OVERDUE" },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        ...notDeleted,
        status: "SUCCEEDED",
        paidAt: { gte: monthStart },
      },
    }),
    prisma.subscription.findMany({
      where: { ...notDeleted, status: "ACTIVE" },
      select: { amount: true, interval: true },
    }),
  ]);

  const mrr = subs.reduce(
    (sum, s) => sum + Number(s.amount) / INTERVAL_MONTHS[s.interval],
    0,
  );

  return {
    outstanding:
      Number(open._sum.total ?? 0) - Number(open._sum.amountPaid ?? 0),
    openCount: open._count,
    overdue:
      Number(overdue._sum.total ?? 0) - Number(overdue._sum.amountPaid ?? 0),
    overdueCount: overdue._count,
    collectedThisMonth: Number(collectedThisMonth._sum.amount ?? 0),
    mrr,
    arr: mrr * 12,
  };
}

/** Cash actually collected in a "yyyy-MM" month. */
export async function getMonthlyRevenue(period?: string) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    year = y!;
    month = m! - 1;
  }
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const agg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      ...notDeleted,
      status: "SUCCEEDED",
      paidAt: { gte: start, lte: end },
    },
  });
  return Number(agg._sum.amount ?? 0);
}

/**
 * Per-client billing status for a month: what they were invoiced, what they
 * paid, and whether they're new business or a retained account.
 *
 * Clients with no invoice for the month still appear, so nobody quietly slips
 * off the billing run.
 */
export async function getClientBillingStatus(period?: string) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    year = y!;
    month = m! - 1;
  }
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const clients = await prisma.client.findMany({
    where: { ...notDeleted, status: { notIn: ["CHURNED"] } },
    orderBy: { companyName: "asc" },
    select: {
      id: true,
      companyName: true,
      status: true,
      startDate: true,
      monthlyRetainer: true,
      invoices: {
        where: { ...notDeleted, issueDate: { gte: start, lte: end } },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          status: true,
          dueDate: true,
        },
        orderBy: { issueDate: "asc" },
      },
    },
  });

  return clients.map((c) => {
    const invoiced = c.invoices.reduce((s, i) => s + Number(i.total), 0);
    const paid = c.invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    // "New" = the engagement started inside the month being viewed.
    const isNew = !!c.startDate && c.startDate >= start && c.startDate <= end;

    return {
      id: c.id,
      companyName: c.companyName,
      status: c.status,
      startDate: c.startDate,
      isNew,
      retainer: c.monthlyRetainer ? Number(c.monthlyRetainer) : 0,
      invoiceCount: c.invoices.length,
      firstInvoiceId: c.invoices[0]?.id ?? null,
      invoiced,
      paid,
      outstanding: invoiced - paid,
      paymentState:
        c.invoices.length === 0
          ? ("NOT_INVOICED" as const)
          : paid <= 0
            ? ("UNPAID" as const)
            : paid < invoiced - 0.01
              ? ("PARTIAL" as const)
              : ("PAID" as const),
    };
  });
}

export type ClientBillingStatusRow = Awaited<
  ReturnType<typeof getClientBillingStatus>
>[number];

/**
 * Next invoice number. Uses the max existing numeric suffix rather than a
 * count, so deleting an invoice can never cause a duplicate number.
 */
export async function nextInvoiceNumber(): Promise<string> {
  const last = await prisma.invoice.findFirst({
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  const n = last?.invoiceNumber?.match(/(\d+)\s*$/)?.[1];
  const next = n ? Number(n) + 1 : 1001;
  return `INV-${next}`;
}
