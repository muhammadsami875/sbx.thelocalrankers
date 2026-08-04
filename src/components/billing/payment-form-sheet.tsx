"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import {
  paymentSchema,
  PAYMENT_METHOD_LABELS,
  type PaymentFormValues,
} from "@/lib/validations/billing";
import { formatCurrency } from "@/lib/utils";
import { recordPayment } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export type OpenInvoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  outstanding: number;
  dueDate: Date;
};

export function PaymentFormSheet({
  open,
  onOpenChange,
  invoices,
  defaultInvoiceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: OpenInvoice[];
  defaultInvoiceId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      invoiceId: defaultInvoiceId ?? "",
      amount: "" as unknown as number,
      method: "BANK_TRANSFER",
      paidAt: format(new Date(), "yyyy-MM-dd"),
      reference: "",
    },
  });

  const selectedId = form.watch("invoiceId");
  const selected = invoices.find((i) => i.id === selectedId);

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      invoiceId: defaultInvoiceId ?? "",
      amount: "" as unknown as number,
      method: "BANK_TRANSFER",
      paidAt: format(new Date(), "yyyy-MM-dd"),
      reference: "",
    });
  }, [open, defaultInvoiceId, form]);

  // Prefill the full outstanding balance — settling in full is the common case.
  React.useEffect(() => {
    if (selected) {
      form.setValue("amount", selected.outstanding as unknown as number);
    }
  }, [selectedId, selected, form]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Record a payment</SheetTitle>
          <SheetDescription>
            Logging a payment updates the invoice balance and marks it paid once
            it's settled.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setPending(true);
              const result = await recordPayment(values);
              setPending(false);

              if (!result.ok) {
                if (result.fieldErrors) {
                  for (const [field, messages] of Object.entries(result.fieldErrors)) {
                    form.setError(field as keyof PaymentFormValues, {
                      message: messages[0],
                    });
                  }
                }
                toast.error(result.error);
                return;
              }
              toast.success("Payment recorded");
              onOpenChange(false);
              router.refresh();
            })}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {invoices.length === 0 ? (
                <p className="rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                  There are no open invoices to pay. Create one and mark it sent
                  first.
                </p>
              ) : (
                <FormField
                  control={form.control}
                  name="invoiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Invoice<span className="ml-0.5 text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an invoice" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {invoices.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.invoiceNumber} · {i.clientName} ·{" "}
                              {formatCurrency(i.outstanding)} due
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selected && (
                <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="tabular font-semibold">
                      {formatCurrency(selected.outstanding, { cents: true })}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span className="tabular">
                      {format(selected.dueDate, "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Amount<span className="ml-0.5 text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value as string | number}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter less than the full amount to record a part payment.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(PaymentMethod).map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_METHOD_LABELS[m]}
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
                  name="paidAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid on</FormLabel>
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
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="Transaction ID or cheque number" {...field} />
                    </FormControl>
                    <FormMessage />
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
              <Button type="submit" disabled={pending || invoices.length === 0}>
                {pending && <Loader2 className="animate-spin" />}
                Record payment
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
