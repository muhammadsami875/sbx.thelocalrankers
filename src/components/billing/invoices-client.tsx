"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Ban,
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import { InvoiceStatus } from "@prisma/client";
import { toast } from "sonner";
import type {
  ClientOption,
  InvoiceDetail,
  InvoiceRow,
} from "@/lib/queries/billing";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANT,
} from "@/lib/validations/billing";
import { formatCurrency } from "@/lib/utils";
import {
  deleteInvoice,
  setInvoiceStatus,
} from "@/app/(app)/invoices/actions";
import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function InvoicesClient({
  invoices,
  clients,
  openInvoices,
  loadInvoice,
  canCreate,
  canUpdate,
  canDelete,
  canRecordPayment,
}: {
  invoices: InvoiceRow[];
  clients: ClientOption[];
  openInvoices: OpenInvoice[];
  loadInvoice: (id: string) => Promise<InvoiceDetail | null>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canRecordPayment: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<InvoiceDetail | null>(null);
  const [paying, setPaying] = React.useState<string | undefined>();
  const [payOpen, setPayOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  function act(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  // The list row carries only what the table renders, so the edit form is
  // seeded from a fresh full fetch rather than the row.
  async function openEditor(id: string) {
    const full = await loadInvoice(id);
    if (!full) {
      toast.error("That invoice could not be loaded.");
      return;
    }
    setEditing(full);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        {canRecordPayment && (
          <Button
            variant="outline"
            onClick={() => {
              setPaying(undefined);
              setPayOpen(true);
            }}
          >
            <Wallet />
            Record payment
          </Button>
        )}
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New invoice
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="px-0 pb-0">
          {invoices.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No invoices yet. Create one to start tracking revenue.
              </p>
              {canCreate && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setCreating(true)}
                >
                  <Plus />
                  Create your first invoice
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const overdue =
                    inv.outstanding > 0 &&
                    inv.dueDate < new Date() &&
                    inv.status !== "VOID";
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {inv.client.companyName}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                        {format(inv.issueDate, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell
                        className={`tabular whitespace-nowrap ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}
                      >
                        {format(inv.dueDate, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap font-medium">
                        {formatCurrency(inv.total)}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-success">
                        {inv.amountPaid > 0 ? formatCurrency(inv.amountPaid) : "—"}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap font-medium">
                        {inv.outstanding > 0 ? (
                          <span className={overdue ? "text-destructive" : ""}>
                            {formatCurrency(inv.outstanding)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${inv.invoiceNumber}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canRecordPayment && inv.outstanding > 0 && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setPaying(inv.id);
                                  setPayOpen(true);
                                }}
                              >
                                <Wallet />
                                Record payment
                              </DropdownMenuItem>
                            )}
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => openEditor(inv.id)}>
                                <Pencil />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canUpdate && inv.status === "DRAFT" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  act(
                                    () => setInvoiceStatus(inv.id, InvoiceStatus.SENT),
                                    "Marked as sent",
                                  )
                                }
                              >
                                <Send />
                                Mark sent
                              </DropdownMenuItem>
                            )}
                            {canUpdate && inv.outstanding > 0 && (
                              <DropdownMenuItem
                                onClick={() =>
                                  act(
                                    () => setInvoiceStatus(inv.id, InvoiceStatus.PAID),
                                    "Marked as paid in full",
                                  )
                                }
                              >
                                <Check />
                                Mark paid in full
                              </DropdownMenuItem>
                            )}
                            {canUpdate && inv.status !== "VOID" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!confirm(`Void ${inv.invoiceNumber}?`)) return;
                                  act(
                                    () => setInvoiceStatus(inv.id, InvoiceStatus.VOID),
                                    "Invoice voided",
                                  );
                                }}
                              >
                                <Ban />
                                Void
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    if (!confirm(`Delete ${inv.invoiceNumber}?`)) return;
                                    act(
                                      () => deleteInvoice(inv.id),
                                      "Invoice deleted",
                                    );
                                  }}
                                >
                                  <Trash2 />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canCreate && (
        <InvoiceFormSheet
          open={creating}
          onOpenChange={setCreating}
          clients={clients}
        />
      )}
      {canUpdate && editing && (
        <InvoiceFormSheet
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          clients={clients}
          invoice={editing}
        />
      )}
      {canRecordPayment && (
        <PaymentFormSheet
          open={payOpen}
          onOpenChange={setPayOpen}
          invoices={openInvoices}
          defaultInvoiceId={paying}
        />
      )}
    </>
  );
}
