"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { addDays, format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { InvoiceStatus, ServiceType } from "@prisma/client";
import { toast } from "sonner";
import {
  invoiceSchema,
  invoiceTotals,
  INVOICE_STATUS_LABELS,
  type InvoiceFormValues,
} from "@/lib/validations/billing";
import { formatCurrency } from "@/lib/utils";
import type { ClientOption, InvoiceDetail } from "@/lib/queries/billing";
import { createInvoice, updateInvoice } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

/** Common line presets so a retainer or upsell is one click, not typing. */
const PRESETS = [
  { label: "Monthly retainer", service: "LOCAL_SEO" as ServiceType },
  { label: "Upsell — extra service", service: "" as const },
  { label: "One-off project", service: "" as const },
];

export function InvoiceFormSheet({
  open,
  onOpenChange,
  clients,
  invoice,
  defaultClientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientOption[];
  invoice?: InvoiceDetail;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const isEdit = !!invoice;
  const [pending, setPending] = React.useState(false);

  const blank = React.useMemo<InvoiceFormValues>(
    () => ({
      clientId: defaultClientId ?? "",
      status: "DRAFT",
      issueDate: format(new Date(), "yyyy-MM-dd"),
      dueDate: format(addDays(new Date(), 15), "yyyy-MM-dd"),
      taxRate: 0,
      discount: 0,
      notes: "",
      terms: "",
      items: [{ description: "", quantity: 1, unitPrice: "" as unknown as number, service: "" }],
    }),
    [defaultClientId],
  );

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: blank,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      invoice
        ? {
            clientId: invoice.client.id,
            status: invoice.status,
            issueDate: format(invoice.issueDate, "yyyy-MM-dd"),
            dueDate: format(invoice.dueDate, "yyyy-MM-dd"),
            taxRate: invoice.taxRate,
            discount: invoice.discount,
            notes: invoice.notes ?? "",
            terms: invoice.terms ?? "",
            items: invoice.items.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              service: i.service ?? "",
            })),
          }
        : blank,
    );
  }, [open, invoice, blank, form]);

  // Live totals, computed with the same helper the server uses so the preview
  // can never disagree with what gets saved.
  const watched = form.watch();
  const totals = invoiceTotals(
    (watched.items ?? []).map((i) => ({
      quantity: Number(i?.quantity) || 0,
      unitPrice: Number(i?.unitPrice) || 0,
    })),
    Number(watched.taxRate) || 0,
    Number(watched.discount) || 0,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? `Edit ${invoice.invoiceNumber}` : "New invoice"}
          </SheetTitle>
          <SheetDescription>
            Add a line for the retainer, then extra lines for any upsells or
            one-off work.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setPending(true);
              const result = isEdit
                ? await updateInvoice(invoice.id, values)
                : await createInvoice(values);
              setPending(false);

              if (!result.ok) {
                if (result.fieldErrors) {
                  for (const [field, messages] of Object.entries(result.fieldErrors)) {
                    form.setError(field as keyof InvoiceFormValues, {
                      message: messages[0],
                    });
                  }
                }
                toast.error(result.error);
                return;
              }
              toast.success(isEdit ? "Invoice updated" : "Invoice created");
              onOpenChange(false);
              router.refresh();
            })}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
                          {Object.values(InvoiceStatus).map((s) => (
                            <SelectItem key={s} value={s}>
                              {INVOICE_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SimpleField form={form} name="issueDate" label="Issue date" type="date" />
                <SimpleField form={form} name="dueDate" label="Due date" type="date" />
              </div>

              {/* Line items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <FormLabel>Line items</FormLabel>
                  <div className="flex flex-wrap gap-1">
                    {PRESETS.map((p) => (
                      <Button
                        key={p.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          append({
                            description: p.label,
                            quantity: 1,
                            unitPrice: "" as unknown as number,
                            service: p.service,
                          })
                        }
                      >
                        <Plus />
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {fields.map((f, index) => (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1fr_70px_110px_auto] items-start gap-2 rounded-md border border-border p-2"
                    >
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Description" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Qty"
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
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Price"
                                {...field}
                                value={field.value as string | number}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>

                {form.formState.errors.items?.message && (
                  <p className="mt-2 text-xs font-medium text-destructive">
                    {form.formState.errors.items.message}
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    append({
                      description: "",
                      quantity: 1,
                      unitPrice: "" as unknown as number,
                      service: "",
                    })
                  }
                >
                  <Plus />
                  Add line
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SimpleField form={form} name="discount" label="Discount" type="number" />
                <SimpleField form={form} name="taxRate" label="Tax rate (%)" type="number" />
              </div>

              {/* Totals */}
              <div className="rounded-md border border-border bg-muted/50 p-4">
                <dl className="space-y-2 text-sm">
                  <Row label="Subtotal" value={formatCurrency(totals.subtotal, { cents: true })} />
                  {Number(watched.discount) > 0 && (
                    <Row
                      label="Discount"
                      value={`− ${formatCurrency(Number(watched.discount), { cents: true })}`}
                    />
                  )}
                  {totals.taxAmount > 0 && (
                    <Row label="Tax" value={formatCurrency(totals.taxAmount, { cents: true })} />
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <dt className="font-display font-semibold">Total</dt>
                    <dd className="tabular font-display text-lg font-semibold">
                      {formatCurrency(totals.total, { cents: true })}
                    </dd>
                  </div>
                </dl>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Visible to the client" {...field} />
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
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {isEdit ? "Save invoice" : "Create invoice"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

function SimpleField({
  form,
  name,
  label,
  type = "text",
}: {
  form: ReturnType<typeof useForm<InvoiceFormValues>>;
  name: "issueDate" | "dueDate" | "taxRate" | "discount";
  label: string;
  type?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              step={type === "number" ? "0.01" : undefined}
              {...field}
              value={field.value as string | number}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
