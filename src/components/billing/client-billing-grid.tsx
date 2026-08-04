"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Wallet } from "lucide-react";
import type {
  ClientBillingStatusRow,
  ClientOption,
  OpenInvoiceLite,
} from "@/lib/queries/billing";
import { formatCurrency } from "@/lib/utils";
import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
import { PaymentFormSheet } from "@/components/billing/payment-form-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATE_LABEL = {
  NOT_INVOICED: "Not invoiced",
  UNPAID: "Unpaid",
  PARTIAL: "Part paid",
  PAID: "Paid",
} as const;

const STATE_VARIANT = {
  NOT_INVOICED: "muted",
  UNPAID: "danger",
  PARTIAL: "warning",
  PAID: "success",
} as const;

/**
 * Month-by-month billing status for every client, split into fresh business
 * and retained accounts so it's obvious who started this month.
 */
export function ClientBillingGrid({
  rows,
  clients,
  openInvoices,
  monthLabel,
  canInvoice,
  canPay,
}: {
  rows: ClientBillingStatusRow[];
  clients: ClientOption[];
  openInvoices: OpenInvoiceLite[];
  monthLabel: string;
  canInvoice: boolean;
  canPay: boolean;
}) {
  const router = useRouter();
  const [invoiceFor, setInvoiceFor] = React.useState<string | undefined>();
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [payFor, setPayFor] = React.useState<string | undefined>();
  const [payOpen, setPayOpen] = React.useState(false);

  const fresh = rows.filter((r) => r.isNew);
  const retained = rows.filter((r) => !r.isNew);

  const totals = rows.reduce(
    (acc, r) => ({
      invoiced: acc.invoiced + r.invoiced,
      paid: acc.paid + r.paid,
      outstanding: acc.outstanding + r.outstanding,
    }),
    { invoiced: 0, paid: 0, outstanding: 0 },
  );

  function renderTable(list: ClientBillingStatusRow[]) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Client</TableHead>
            <TableHead>Retainer</TableHead>
            <TableHead>Invoiced</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-56 truncate font-medium">
                <Link
                  href={`/clients/${r.id}`}
                  className="hover:text-accent hover:underline"
                >
                  {r.companyName}
                </Link>
              </TableCell>
              <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                {r.retainer > 0 ? `${formatCurrency(r.retainer)}/mo` : "—"}
              </TableCell>
              <TableCell className="tabular whitespace-nowrap font-medium">
                {r.invoiced > 0 ? formatCurrency(r.invoiced) : "—"}
              </TableCell>
              <TableCell className="tabular whitespace-nowrap text-success">
                {r.paid > 0 ? formatCurrency(r.paid) : "—"}
              </TableCell>
              <TableCell className="tabular whitespace-nowrap font-medium">
                {r.outstanding > 0 ? (
                  <span className="text-destructive">
                    {formatCurrency(r.outstanding)}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <Badge variant={STATE_VARIANT[r.paymentState]}>
                  {STATE_LABEL[r.paymentState]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  {canInvoice && r.paymentState === "NOT_INVOICED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInvoiceFor(r.id);
                        setInvoiceOpen(true);
                      }}
                    >
                      <Plus />
                      Invoice
                    </Button>
                  )}
                  {canPay && r.outstanding > 0 && r.firstInvoiceId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPayFor(r.firstInvoiceId!);
                        setPayOpen(true);
                      }}
                    >
                      <Wallet />
                      Record payment
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label={`Invoiced in ${monthLabel}`} value={formatCurrency(totals.invoiced)} />
        <Tile label="Collected" value={formatCurrency(totals.paid)} tone="success" />
        <Tile
          label="Still owed"
          value={formatCurrency(totals.outstanding)}
          tone={totals.outstanding > 0 ? "danger" : undefined}
        />
      </div>

      {fresh.length > 0 && (
        <Card className="mb-4 border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <CardTitle>New this month ({fresh.length})</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Fresh business that started in {monthLabel}
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-0">{renderTable(fresh)}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Existing clients ({retained.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Retained accounts — update who has paid for {monthLabel}
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {retained.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No existing clients for this month.
            </p>
          ) : (
            renderTable(retained)
          )}
        </CardContent>
      </Card>

      {canInvoice && (
        <InvoiceFormSheet
          open={invoiceOpen}
          onOpenChange={(o) => {
            setInvoiceOpen(o);
            if (!o) {
              setInvoiceFor(undefined);
              router.refresh();
            }
          }}
          clients={clients}
          defaultClientId={invoiceFor}
        />
      )}
      {canPay && (
        <PaymentFormSheet
          open={payOpen}
          onOpenChange={(o) => {
            setPayOpen(o);
            if (!o) {
              setPayFor(undefined);
              router.refresh();
            }
          }}
          invoices={openInvoices}
          defaultInvoiceId={payFor}
        />
      )}
    </>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
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
    </Card>
  );
}
