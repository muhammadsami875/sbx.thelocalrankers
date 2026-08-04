"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  subscriptionSchema,
  BILLING_INTERVAL_LABELS,
  INTERVAL_MONTHS,
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionFormValues,
} from "@/lib/validations/billing";
import type { ClientOption } from "@/lib/queries/billing";
import { formatCurrency } from "@/lib/utils";
import { upsertSubscription } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

/** "Add package" entry point for the team-wide subscriptions page. */
export function SubscriptionsClient({
  clients,
  canManage,
}: {
  clients: ClientOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      clientId: "",
      name: "",
      amount: "" as unknown as number,
      interval: "MONTHLY",
      status: "ACTIVE",
      startDate: format(new Date(), "yyyy-MM-dd"),
      nextInvoiceDate: "",
      autoRenew: true,
    },
  });

  const clientId = form.watch("clientId");
  const amount = Number(form.watch("amount")) || 0;
  const interval = form.watch("interval");
  const monthly = amount / (INTERVAL_MONTHS[interval as BillingInterval] ?? 1);

  // Prefill the name and amount from the chosen client's existing retainer.
  React.useEffect(() => {
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    if (!form.getValues("name")) {
      form.setValue("name", `${c.companyName} — Monthly Retainer`);
    }
    if (!form.getValues("amount") && c.monthlyRetainer) {
      form.setValue("amount", c.monthlyRetainer as unknown as number);
    }
  }, [clientId, clients, form]);

  if (!canManage) return null;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Add package
        </Button>
      </div>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) form.reset();
        }}
      >
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add package</SheetTitle>
            <SheetDescription>
              Sets a client&apos;s recurring retainer. An active monthly package
              also updates their headline retainer figure.
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                setPending(true);
                const result = await upsertSubscription(values);
                setPending(false);

                if (!result.ok) {
                  if (result.fieldErrors) {
                    for (const [f, m] of Object.entries(result.fieldErrors)) {
                      form.setError(f as keyof SubscriptionFormValues, {
                        message: m[0],
                      });
                    }
                  }
                  toast.error(result.error);
                  return;
                }
                toast.success("Package added");
                setOpen(false);
                form.reset();
                router.refresh();
              })}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Client<span className="ml-0.5 text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.companyName}
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package name</FormLabel>
                      <FormControl>
                        <Input placeholder="Local SEO — Growth" {...field} />
                      </FormControl>
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
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="1500"
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
                    name="interval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billed</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(BillingInterval).map((i) => (
                              <SelectItem key={i} value={i}>
                                {BILLING_INTERVAL_LABELS[i]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {amount > 0 && interval !== "MONTHLY" && (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    Counts as{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(monthly)}/month
                    </span>{" "}
                    toward MRR.
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nextInvoiceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Next invoice</FormLabel>
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(SubscriptionStatus).map((s) => (
                            <SelectItem key={s} value={s}>
                              {SUBSCRIPTION_STATUS_LABELS[s]}
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
                  name="autoRenew"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <FormLabel>Auto-renew</FormLabel>
                        <FormDescription>
                          Keep billing when the term ends.
                        </FormDescription>
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
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Add package
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </>
  );
}
