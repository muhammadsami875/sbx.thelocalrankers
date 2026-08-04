"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MoreHorizontal, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { PaymentRow } from "@/lib/queries/billing";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/billing";
import { formatCurrency } from "@/lib/utils";
import { deletePayment } from "@/app/(app)/invoices/actions";
import {
  PaymentFormSheet,
  type OpenInvoice,
} from "@/components/billing/payment-form-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PaymentsClient({
  payments,
  openInvoices,
  canRecord,
  canDelete,
}: {
  payments: PaymentRow[];
  openInvoices: OpenInvoice[];
  canRecord: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  return (
    <>
      {canRecord && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Record payment
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="px-0 pb-0">
          {payments.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
              {canRecord && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setOpen(true)}
                >
                  <Plus />
                  Record the first payment
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular whitespace-nowrap">
                      {p.paidAt ? format(p.paidAt, "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      <Link
                        href={`/clients/${p.invoice.client.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {p.invoice.client.companyName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {p.invoice.invoiceNumber}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap font-semibold text-success">
                      {formatCurrency(p.amount, { cents: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">
                        {PAYMENT_METHOD_LABELS[p.method]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                      {p.reference ?? "—"}
                    </TableCell>
                    <TableCell>
                      {canDelete && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Payment actions"
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (
                                  !confirm(
                                    `Reverse this ${formatCurrency(p.amount)} payment? The invoice balance goes back up.`,
                                  )
                                )
                                  return;
                                startTransition(async () => {
                                  const r = await deletePayment(p.id);
                                  if (r.ok) {
                                    toast.success("Payment reversed");
                                    router.refresh();
                                  } else {
                                    toast.error(r.error);
                                  }
                                });
                              }}
                            >
                              <Undo2 />
                              Reverse payment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canRecord && (
        <PaymentFormSheet
          open={open}
          onOpenChange={setOpen}
          invoices={openInvoices}
        />
      )}
    </>
  );
}
