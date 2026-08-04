"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { ExpenseCategory } from "@prisma/client";
import { toast } from "sonner";
import {
  expenseSchema,
  type ExpenseFormValues,
} from "@/lib/validations/expense";
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseRow,
} from "@/lib/queries/expenses";
import { formatCurrency } from "@/lib/utils";
import { formatDateOnly } from "@/lib/date-only";
import {
  createExpense,
  deleteExpense,
  postPayrollToExpenses,
  updateExpense,
} from "@/app/(app)/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function ExpensesClient({
  expenses,
  period,
  canManage,
}: {
  expenses: ExpenseRow[];
  period: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseRow | null>(null);
  const [postingPayroll, setPostingPayroll] = React.useState(false);
  const [, startTransition] = React.useTransition();

  return (
    <>
      {canManage && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={postingPayroll}
            onClick={async () => {
              if (
                !confirm(
                  `Post ${period} payroll to expenses? Salary and commission become expense rows so they count against profit. Safe to re-run — it updates rather than duplicates.`,
                )
              )
                return;
              setPostingPayroll(true);
              const r = await postPayrollToExpenses(period);
              setPostingPayroll(false);
              if (r.ok) {
                toast.success(r.message ?? "Payroll posted");
                router.refresh();
              } else {
                toast.error(r.error);
              }
            }}
          >
            {postingPayroll ? <Loader2 className="animate-spin" /> : <Wallet />}
            Post payroll to expenses
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Add expense
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="px-0 pb-0">
          {expenses.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No expenses recorded for this month.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Profit is revenue minus these, so add them to get a true figure.
              </p>
              {canManage && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setCreating(true)}
                >
                  <Plus />
                  Add the first expense
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular whitespace-nowrap">
                      {formatDateOnly(e.incurredOn, { month: "short", day: "numeric" })}
                    </TableCell>
                    <TableCell className="max-w-72 truncate font-medium">
                      {e.description}
                      {e.isRecurring && (
                        <Badge variant="muted" className="ml-2">
                          Recurring
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.category === "SALARY" || e.category === "COMMISSION"
                            ? "info"
                            : "muted"
                        }
                      >
                        {EXPENSE_CATEGORY_LABELS[e.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-muted-foreground">
                      {e.vendor ?? "—"}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap font-semibold text-destructive">
                      {formatCurrency(e.amount, { cents: true })}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${e.description}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(e)}>
                              <Pencil />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (!confirm(`Delete "${e.description}"?`)) return;
                                startTransition(async () => {
                                  const r = await deleteExpense(e.id);
                                  if (r.ok) {
                                    toast.success("Expense deleted");
                                    router.refresh();
                                  } else {
                                    toast.error(r.error);
                                  }
                                });
                              }}
                            >
                              <Trash2 />
                              Delete
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

      {canManage && (
        <ExpenseSheet
          open={creating || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreating(false);
              setEditing(null);
            }
          }}
          expense={editing}
          period={period}
        />
      )}
    </>
  );
}

function ExpenseSheet({
  open,
  onOpenChange,
  expense,
  period,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseRow | null;
  period: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  // Default to the first of the month being viewed, not today — you're usually
  // entering expenses for the period on screen.
  const defaultDate = `${period}-01`;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      category: "OTHER",
      amount: "" as unknown as number,
      currency: "USD",
      incurredOn: defaultDate,
      vendor: "",
      notes: "",
      isRecurring: false,
      clientId: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      expense
        ? {
            description: expense.description,
            category: expense.category,
            amount: expense.amount,
            currency: expense.currency,
            incurredOn: format(expense.incurredOn, "yyyy-MM-dd"),
            vendor: expense.vendor ?? "",
            notes: expense.notes ?? "",
            isRecurring: expense.isRecurring,
            clientId: expense.clientId ?? "",
          }
        : {
            description: "",
            category: "OTHER",
            amount: "" as unknown as number,
            currency: "USD",
            incurredOn: defaultDate,
            vendor: "",
            notes: "",
            isRecurring: false,
            clientId: "",
          },
    );
  }, [open, expense, defaultDate, form]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{expense ? "Edit expense" : "Add expense"}</SheetTitle>
          <SheetDescription>
            Expenses are subtracted from revenue to give profit.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setPending(true);
              const result = expense
                ? await updateExpense(expense.id, values)
                : await createExpense(values);
              setPending(false);

              if (!result.ok) {
                if (result.fieldErrors) {
                  for (const [f, m] of Object.entries(result.fieldErrors)) {
                    form.setError(f as keyof ExpenseFormValues, { message: m[0] });
                  }
                }
                toast.error(result.error);
                return;
              }
              toast.success(expense ? "Expense updated" : "Expense added");
              onOpenChange(false);
              router.refresh();
            })}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Ahrefs subscription" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="199.00"
                          {...field}
                          value={field.value as string | number}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input maxLength={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(ExpenseCategory).map((c) => (
                            <SelectItem key={c} value={c}>
                              {EXPENSE_CATEGORY_LABELS[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="incurredOn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input placeholder="Ahrefs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isRecurring"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <FormLabel>Recurring</FormLabel>
                      <FormDescription>Happens every month.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {expense ? "Save expense" : "Add expense"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
