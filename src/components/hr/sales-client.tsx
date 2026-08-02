"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { SaleRow } from "@/lib/queries/hr";
import { formatMoney } from "@/lib/payroll";
import { SALE_STATUS_LABELS, SALE_STATUS_VARIANT } from "@/lib/validations/hr";
import { deleteSale, setSaleStatus } from "@/app/(app)/sales/actions";
import { SaleFormSheet } from "@/components/hr/sale-form-sheet";
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

export function SalesClient({
  sales,
  commissionRate,
  payrollCurrency,
  defaultRate,
  canApprove,
  showEmployee,
}: {
  sales: SaleRow[];
  commissionRate: number;
  payrollCurrency: string;
  defaultRate: number;
  canApprove: boolean;
  showEmployee: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
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

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Log a sale
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 pb-0">
          {sales.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No sales logged this month.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setOpen(true)}
              >
                <Plus />
                Log your first sale
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  {showEmployee && <TableHead>Employee</TableHead>}
                  <TableHead>Description</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Converted</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(s.saleDate, "MMM d")}
                    </TableCell>
                    {showEmployee && (
                      <TableCell className="whitespace-nowrap">
                        {s.employee.user.name ?? "—"}
                      </TableCell>
                    )}
                    <TableCell className="max-w-64 truncate font-medium">
                      {s.description}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap">
                      {s.currency} {s.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {formatMoney(s.amountConverted, payrollCurrency)}
                      <span className="ml-1 text-xs">@{s.exchangeRate}</span>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap font-semibold text-success">
                      {formatMoney(s.commissionAmount, payrollCurrency)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {s.commissionRate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SALE_STATUS_VARIANT[s.status]}>
                        {SALE_STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${s.description}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canApprove && s.status !== "APPROVED" && (
                            <DropdownMenuItem
                              onClick={() =>
                                act(
                                  () => setSaleStatus(s.id, "APPROVED"),
                                  "Sale approved",
                                )
                              }
                            >
                              <Check />
                              Approve
                            </DropdownMenuItem>
                          )}
                          {canApprove && s.status !== "REJECTED" && (
                            <DropdownMenuItem
                              onClick={() =>
                                act(
                                  () => setSaleStatus(s.id, "REJECTED"),
                                  "Sale rejected",
                                )
                              }
                            >
                              <X />
                              Reject
                            </DropdownMenuItem>
                          )}
                          {canApprove && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              if (!confirm(`Delete "${s.description}"?`)) return;
                              act(() => deleteSale(s.id), "Sale deleted");
                            }}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SaleFormSheet
        open={open}
        onOpenChange={setOpen}
        commissionRate={commissionRate}
        payrollCurrency={payrollCurrency}
        defaultRate={defaultRate}
      />
    </>
  );
}
