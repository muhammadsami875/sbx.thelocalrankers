import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  getBillingSummary,
  getClientBillingStatus,
  getClientOptions,
  getOpenInvoices,
  getPayments,
  getSubscriptions,
} from "@/lib/queries/billing";
import { ClientBillingGrid } from "@/components/billing/client-billing-grid";
import { MonthPicker } from "@/components/hr/month-picker";
import { monthRange } from "@/lib/queries/hr";
import { formatCurrency } from "@/lib/utils";
import {
  BILLING_INTERVAL_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/validations/billing";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentsClient } from "@/components/billing/payments-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { key, start } = monthRange(params.month);

  const [session, payments, openInvoices, summary, subscriptions, billingRows, clients] =
    await Promise.all([
      auth(),
      getPayments({}),
      getOpenInvoices(),
      getBillingSummary(),
      getSubscriptions(),
      getClientBillingStatus(params.month),
      getClientOptions(),
    ]);

  const role = session!.user.role;
  const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE");

  return (
    <>
      <PageHeader
        title="Payments"
        description="Who has paid, who hasn't, month by month"
        actions={<MonthPicker value={key} />}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Collected this month"
          value={formatCurrency(summary.collectedThisMonth)}
          tone="success"
        />
        <Tile
          label="Outstanding"
          value={formatCurrency(summary.outstanding)}
          hint={`${summary.openCount} open invoices`}
        />
        <Tile
          label="Overdue"
          value={formatCurrency(summary.overdue)}
          hint={`${summary.overdueCount} past due`}
          tone={summary.overdue > 0 ? "danger" : undefined}
        />
        <Tile
          label="Recurring revenue"
          value={formatCurrency(summary.mrr)}
          hint={`${activeSubs.length} active packages`}
        />
      </div>

      <ClientBillingGrid
        rows={billingRows}
        clients={clients}
        openInvoices={openInvoices}
        monthLabel={start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
        canInvoice={can(role, "invoices:create")}
        canPay={can(role, "payments:create")}
      />

      <div className="mt-6" />

      <PaymentsClient
        payments={payments}
        openInvoices={openInvoices}
        canRecord={can(role, "payments:create")}
        canDelete={can(role, "payments:delete")}
      />

      {/* Retainers / packages */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recurring packages</CardTitle>
          <p className="text-sm text-muted-foreground">
            Retainers billed on a schedule. Manage a client&apos;s package from
            their Billing tab.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {subscriptions.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No recurring packages yet. Open a client and add one under Billing.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Monthly value</TableHead>
                  <TableHead>Next invoice</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-48 truncate font-medium">
                      <Link
                        href={`/clients/${s.client.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {s.client.companyName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{s.name}</TableCell>
                    <TableCell className="tabular whitespace-nowrap font-medium">
                      {formatCurrency(s.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {BILLING_INTERVAL_LABELS[s.interval]}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap">
                      {formatCurrency(s.monthlyValue)}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {s.nextInvoiceDate
                        ? format(s.nextInvoiceDate, "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.status === "ACTIVE"
                            ? "success"
                            : s.status === "PAST_DUE"
                              ? "danger"
                              : "muted"
                        }
                      >
                        {SUBSCRIPTION_STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "";
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`tabular mt-2 font-display text-2xl font-semibold ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
