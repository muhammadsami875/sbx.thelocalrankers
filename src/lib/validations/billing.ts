import { z } from "zod";
import {
  BillingInterval,
  InvoiceStatus,
  PaymentMethod,
  ServiceType,
  SubscriptionStatus,
} from "@prisma/client";

const optionalString = z.string().trim().optional().or(z.literal(""));
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Describe the line").max(300),
  quantity: z.coerce.number().min(0.01, "Must be greater than zero").default(1),
  unitPrice: z.coerce.number().min(0, "Cannot be negative"),
  service: z.union([z.nativeEnum(ServiceType), z.literal("")]).optional(),
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1, "Choose a client"),
  status: z.nativeEnum(InvoiceStatus).default("DRAFT"),
  issueDate: dateString,
  dueDate: dateString,
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discount: z.coerce.number().min(0).default(0),
  notes: optionalString,
  terms: optionalString,
  items: z
    .array(invoiceItemSchema)
    .min(1, "Add at least one line item"),
});

export type InvoiceFormValues = z.input<typeof invoiceSchema>;

export const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Choose an invoice"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.nativeEnum(PaymentMethod).default("STRIPE_CARD"),
  paidAt: dateString,
  reference: optionalString,
});

export type PaymentFormValues = z.input<typeof paymentSchema>;

export const subscriptionSchema = z.object({
  clientId: z.string().min(1, "Choose a client"),
  name: z.string().trim().min(2, "Name the package").max(160),
  amount: z.coerce.number().min(0, "Cannot be negative"),
  interval: z.nativeEnum(BillingInterval).default("MONTHLY"),
  status: z.nativeEnum(SubscriptionStatus).default("ACTIVE"),
  startDate: dateString,
  nextInvoiceDate: dateString.optional().or(z.literal("")),
  autoRenew: z.boolean().default(true),
});

export type SubscriptionFormValues = z.input<typeof subscriptionSchema>;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIALLY_PAID: "Part paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
  REFUNDED: "Refunded",
};

export const INVOICE_STATUS_VARIANT: Record<
  InvoiceStatus,
  "muted" | "info" | "warning" | "success" | "danger"
> = {
  DRAFT: "muted",
  SENT: "info",
  VIEWED: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "muted",
  REFUNDED: "muted",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  STRIPE_CARD: "Card (Stripe)",
  STRIPE_ACH: "ACH (Stripe)",
  AUTHORIZE_NET: "Authorize.Net",
  BANK_TRANSFER: "Bank transfer",
  CHECK: "Check",
  CASH: "Cash",
  PAYPAL: "PayPal",
  OTHER: "Other",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  TRIALING: "Trialing",
};

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-annual",
  ANNUAL: "Annual",
};

/** Months per interval — used to normalise everything to MRR. */
export const INTERVAL_MONTHS: Record<BillingInterval, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

/** Recomputes invoice money from its lines. Kept pure so UI and server agree. */
export function invoiceTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRatePercent = 0,
  discount = 0,
) {
  const subtotal = items.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
    0,
  );
  const afterDiscount = Math.max(0, subtotal - (Number(discount) || 0));
  const taxAmount = (afterDiscount * (Number(taxRatePercent) || 0)) / 100;
  return {
    subtotal: round2(subtotal),
    taxAmount: round2(taxAmount),
    total: round2(afterDiscount + taxAmount),
  };
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
