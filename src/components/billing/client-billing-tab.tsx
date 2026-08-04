"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Ban, Loader2, Package, Pencil, Plus } from "lucide-react";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  subscriptionSchema,
  BILLING_INTERVAL_LABELS,
  INTERVAL_MONTHS,
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionFormValues,
} from "@/lib/validations/billing";
import type { SubscriptionRow } from "@/lib/queries/billing";
import { formatCurrency } from "@/lib/utils";
import {
  cancelSubscription,
  upsertSubscription,
} from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function ClientBillingTab({
  clientId,
  clientName,
  subscriptions,
  canManage,
}: {
  clientId: string;
  clientName: string;
  subscriptions: SubscriptionRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<SubscriptionRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const mrr = subscriptions
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => sum + s.monthlyValue, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Packages &amp; retainers</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {mrr > 0
                  ? `${formatCurrency(mrr)}/mo recurring`
                  : "No recurring revenue set up"}
              </p>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus />
                Add package
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="py-10 text-center">
              <Package className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No package yet. Add one to set this client&apos;s monthly
                retainer and track it as recurring revenue.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {subscriptions.map((s) => (
                <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{s.name}</p>
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
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatCurrency(s.amount)}{" "}
                        {BILLING_INTERVAL_LABELS[s.interval].toLowerCase()}
                        {s.interval !== "MONTHLY" &&
                          ` · ${formatCurrency(s.monthlyValue)}/mo equivalent`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Started {format(s.startDate, "MMM d, yyyy")}
                        {s.nextInvoiceDate &&
                          ` · next invoice ${format(s.nextInvoiceDate, "MMM d, yyyy")}`}
                        {!s.autoRenew && " · auto-renew off"}
                      </p>
                    </div>

                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${s.name}`}
                          onClick={() => setEditing(s)}
                        >
                          <Pencil />
                        </Button>
                        {s.status !== "CANCELLED" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Cancel ${s.name}`}
                            onClick={() => {
                              if (
                                !confirm(
                                  `Cancel "${s.name}"? It stops counting toward recurring revenue.`,
                                )
                              )
                                return;
                              startTransition(async () => {
                                const r = await cancelSubscription(s.id);
                                if (r.ok) {
                                  toast.success("Package cancelled");
                                  router.refresh();
                                } else {
                                  toast.error(r.error);
                                }
                              });
                            }}
                          >
                            <Ban />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <PackageDialog
          open={creating || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreating(false);
              setEditing(null);
            }
          }}
          clientId={clientId}
          clientName={clientName}
          subscription={editing}
        />
      )}
    </>
  );
}

function PackageDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  subscription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  subscription: SubscriptionRow | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      clientId,
      name: "",
      amount: "" as unknown as number,
      interval: "MONTHLY",
      status: "ACTIVE",
      startDate: format(new Date(), "yyyy-MM-dd"),
      nextInvoiceDate: "",
      autoRenew: true,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      subscription
        ? {
            clientId,
            name: subscription.name,
            amount: subscription.amount,
            interval: subscription.interval,
            status: subscription.status,
            startDate: format(subscription.startDate, "yyyy-MM-dd"),
            nextInvoiceDate: subscription.nextInvoiceDate
              ? format(subscription.nextInvoiceDate, "yyyy-MM-dd")
              : "",
            autoRenew: subscription.autoRenew,
          }
        : {
            clientId,
            name: `${clientName} — Monthly Retainer`,
            amount: "" as unknown as number,
            interval: "MONTHLY",
            status: "ACTIVE",
            startDate: format(new Date(), "yyyy-MM-dd"),
            nextInvoiceDate: "",
            autoRenew: true,
          },
    );
  }, [open, subscription, clientId, clientName, form]);

  const amount = Number(form.watch("amount")) || 0;
  const interval = form.watch("interval");
  const monthly = amount / (INTERVAL_MONTHS[interval as BillingInterval] ?? 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {subscription ? "Edit package" : "Add package"}
          </DialogTitle>
          <DialogDescription>
            Sets the recurring retainer for {clientName}. An active monthly
            package also updates the client&apos;s headline retainer figure.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setPending(true);
              const result = await upsertSubscription(values, subscription?.id);
              setPending(false);

              if (!result.ok) {
                if (result.fieldErrors) {
                  for (const [field, messages] of Object.entries(result.fieldErrors)) {
                    form.setError(field as keyof SubscriptionFormValues, {
                      message: messages[0],
                    });
                  }
                }
                toast.error(result.error);
                return;
              }
              toast.success(subscription ? "Package updated" : "Package added");
              onOpenChange(false);
              router.refresh();
            })}
            className="space-y-4"
          >
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
                toward recurring revenue.
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

            <DialogFooter>
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
                {subscription ? "Save package" : "Add package"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
