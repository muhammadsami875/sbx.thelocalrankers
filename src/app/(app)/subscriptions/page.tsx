import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Repeat } from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getClientOptions, getSubscriptions } from "@/lib/queries/billing";
import { formatCurrency } from "@/lib/utils";
import {
  BILLING_INTERVAL_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/validations/billing";
import { PageHeader } from "@/components/layout/page-header";
import { SubscriptionsClient } from "@/components/billing/subscriptions-client";
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

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage() {
  const [session, subscriptions, clients] = await Promise.all([
    auth(),
    getSubscriptions(),
    getClientOptions(),
  ]);

  const role = session!.user.role;
  const canManage = can(role, "subscriptions:update");

  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  const mrr = active.reduce((sum, s) => sum + s.monthlyValue, 0);
  const pastDue = subscriptions.filter((s) => s.status === "PAST_DUE");

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Recurring retainers and packages"
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="MRR" value={formatCurrency(mrr)} tone="success" />
        <Tile label="ARR" value={formatCurrency(mrr * 12)} />
        <Tile
          label="Active packages"
          value={String(active.length)}
          hint={`${subscriptions.length} total`}
        />
        <Tile
          label="Past due"
          value={String(pastDue.length)}
          tone={pastDue.length > 0 ? "danger" : undefined}
        />
      </div>

      <SubscriptionsClient clients={clients} canManage={canManage} />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>All packages</CardTitle>
          <p className="text-sm text-muted-foreground">
            Non-monthly intervals are normalised into the MRR figure above.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {subscriptions.length === 0 ? (
            <div className="py-16 text-center">
              <Repeat className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No recurring packages yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add one above, or from a client&apos;s Billing tab.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Monthly value</TableHead>
                  <TableHead>Started</TableHead>
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
                      {format(s.startDate, "MMM d, yyyy")}
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
