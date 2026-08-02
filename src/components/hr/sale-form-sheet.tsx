"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saleSchema, type SaleFormValues } from "@/lib/validations/hr";
import { createSale } from "@/app/(app)/sales/actions";
import { formatMoney } from "@/lib/payroll";
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

export function SaleFormSheet({
  open,
  onOpenChange,
  commissionRate,
  payrollCurrency,
  defaultRate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionRate: number;
  payrollCurrency: string;
  /** Last used FX rate, so the field isn't blank every time. */
  defaultRate: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      description: "",
      saleDate: format(new Date(), "yyyy-MM-dd"),
      amount: "" as unknown as number,
      currency: "USD",
      exchangeRate: defaultRate as unknown as number,
      clientId: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        description: "",
        saleDate: format(new Date(), "yyyy-MM-dd"),
        amount: "" as unknown as number,
        currency: "USD",
        exchangeRate: defaultRate as unknown as number,
        clientId: "",
      });
    }
  }, [open, defaultRate, form]);

  // Live preview so the employee sees what they'll earn before submitting.
  const amount = Number(form.watch("amount")) || 0;
  const rate = Number(form.watch("exchangeRate")) || 0;
  const currency = form.watch("currency") || "USD";
  const converted = amount * rate;
  const commission = (converted * commissionRate) / 100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Log a sale</SheetTitle>
          <SheetDescription>
            Record a deal you closed. It goes in as pending until a manager
            approves it, then it counts toward your commission.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setPending(true);
              const result = await createSale(values);
              setPending(false);

              if (!result.ok) {
                if (result.fieldErrors) {
                  for (const [field, messages] of Object.entries(result.fieldErrors)) {
                    form.setError(field as keyof SaleFormValues, {
                      message: messages[0],
                    });
                  }
                }
                toast.error(result.error);
                return;
              }
              toast.success("Sale logged — pending approval.");
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
                    <FormLabel>What did you close?</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Local SEO retainer — Acme Roofing"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="saleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Determines which month&apos;s payroll it lands in.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deal value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="200"
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
                        <Input maxLength={3} placeholder="USD" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Exchange rate ({payrollCurrency} per 1 {currency || "USD"})
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="278.50"
                        {...field}
                        value={field.value as string | number}
                      />
                    </FormControl>
                    <FormDescription>
                      Locked to this sale, so a later rate change never alters
                      what you already earned. Use 1 if the deal is already in{" "}
                      {payrollCurrency}.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {amount > 0 && rate > 0 && (
                <div className="rounded-md border border-border bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    You&apos;ll earn
                  </p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Deal value</dt>
                      <dd className="tabular font-medium">
                        {currency} {amount.toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Converted @ {rate.toLocaleString()}
                      </dt>
                      <dd className="tabular font-medium">
                        {formatMoney(converted, payrollCurrency)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <dt className="font-medium">
                        Commission @ {commissionRate}%
                      </dt>
                      <dd className="tabular font-semibold text-success">
                        {formatMoney(commission, payrollCurrency)}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
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
                Log sale
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
