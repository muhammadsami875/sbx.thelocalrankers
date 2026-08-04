"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import { ClientStatus, Priority, ServiceType } from "@prisma/client";
import { toast } from "sonner";
import {
  CLIENT_STATUS_LABELS,
  PRIORITY_LABELS,
  SERVICE_LABELS,
  clientSchema,
  type ClientFormValues,
} from "@/lib/validations/client";
import { cn } from "@/lib/utils";
import {
  createClient,
  loadClientFormOptions,
  loadClientForForm,
  updateClient,
} from "@/app/(app)/clients/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Manager = { id: string; name: string | null; image: string | null };

const EMPTY: ClientFormValues = {
  companyName: "",
  ownerName: "",
  contactPerson: "",
  email: "",
  phone: "",
  website: "",
  businessCategory: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "United States",
  googleBusinessProfile: "",
  facebookUrl: "",
  instagramUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  twitterUrl: "",
  logoUrl: "",
  notes: "",
  status: "ACTIVE",
  priority: "MEDIUM",
  monthlyRetainer: "",
  startDate: "",
  renewalDate: "",
  accountManagerId: "",
  services: [],
  tags: [],
};

export function ClientFormSheet({
  open,
  onOpenChange,
  managers: managersProp,
  allTags: allTagsProp,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional — the sheet fetches these itself when not supplied. */
  managers?: Manager[];
  allTags?: { id: string; name: string; color: string }[];
  /** Present when editing. The full record is fetched from this id. */
  clientId?: string;
}) {
  const router = useRouter();
  const isEdit = !!clientId;

  const [managers, setManagers] = React.useState<Manager[]>(managersProp ?? []);
  const [allTags, setAllTags] = React.useState<
    { id: string; name: string; color: string }[]
  >(allTagsProp ?? []);

  // Pickers are fetched on open so callers never have to thread them through.
  React.useEffect(() => {
    if (!open || (managersProp?.length && allTagsProp?.length)) return;
    let cancelled = false;
    loadClientFormOptions()
      .then((o) => {
        if (cancelled) return;
        setManagers(o.managers);
        setAllTags(o.tags);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, managersProp, allTagsProp]);
  const [pending, setPending] = React.useState(false);
  const [tagInput, setTagInput] = React.useState("");

  const [loading, setLoading] = React.useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: EMPTY,
  });

  // Reset whenever the sheet opens so stale values never leak between rows.
  //
  // On edit the full record is fetched rather than seeded from the table row:
  // the list query selects only the columns the table renders, so anything it
  // omits (address, socials, notes…) would be submitted blank and wipe the
  // stored value.
  React.useEffect(() => {
    if (!open) return;
    setTagInput("");

    if (!clientId) {
      form.reset(EMPTY);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadClientForForm(clientId)
      .then((full) => {
        if (cancelled) return;
        if (!full) {
          toast.error("That client could not be loaded.");
          onOpenChange(false);
          return;
        }
        form.reset({
          companyName: full.companyName,
          ownerName: full.ownerName ?? "",
          contactPerson: full.contactPerson ?? "",
          email: full.email ?? "",
          phone: full.phone ?? "",
          website: full.website ?? "",
          businessCategory: full.businessCategory ?? "",
          addressLine1: full.addressLine1 ?? "",
          addressLine2: full.addressLine2 ?? "",
          city: full.city ?? "",
          state: full.state ?? "",
          zipCode: full.zipCode ?? "",
          country: full.country ?? "",
          googleBusinessProfile: full.googleBusinessProfile ?? "",
          facebookUrl: full.facebookUrl ?? "",
          instagramUrl: full.instagramUrl ?? "",
          linkedinUrl: full.linkedinUrl ?? "",
          youtubeUrl: full.youtubeUrl ?? "",
          tiktokUrl: full.tiktokUrl ?? "",
          twitterUrl: full.twitterUrl ?? "",
          logoUrl: full.logoUrl ?? "",
          notes: full.notes ?? "",
          status: full.status,
          priority: full.priority,
          monthlyRetainer: full.monthlyRetainer ?? "",
          startDate: full.startDate ? format(full.startDate, "yyyy-MM-dd") : "",
          renewalDate: full.renewalDate
            ? format(full.renewalDate, "yyyy-MM-dd")
            : "",
          accountManagerId: full.accountManagerId ?? "",
          services: full.services,
          tags: full.tags,
        });
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load this client.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, clientId, form, onOpenChange]);

  const services = form.watch("services") ?? [];
  const tags = form.watch("tags") ?? [];

  async function onSubmit(values: ClientFormValues) {
    setPending(true);
    const result = isEdit
      ? await updateClient(clientId, values)
      : await createClient(values);
    setPending(false);

    if (!result.ok) {
      // Surface server-side field errors on the matching inputs.
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ClientFormValues, {
            message: messages[0],
          });
        }
      }
      toast.error(result.error);
      return;
    }

    toast.success(
      isEdit
        ? `${values.companyName} updated`
        : `${values.companyName} added`,
    );
    onOpenChange(false);
    router.refresh();
  }

  function addTag(raw: string) {
    const name = raw.trim();
    if (!name || tags.includes(name)) return;
    form.setValue("tags", [...tags, name], { shouldDirty: true });
    setTagInput("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit client" : "New client"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this client's details, commercials and services."
              : "Add a client to the CRM. Only the company name is required."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <Tabs
              defaultValue="details"
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="px-6 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="address" className="flex-1">
                    Address
                  </TabsTrigger>
                  <TabsTrigger value="social" className="flex-1">
                    Profiles
                  </TabsTrigger>
                  <TabsTrigger value="commercial" className="flex-1">
                    Commercial
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {loading && (
                  <div className="space-y-4" aria-busy>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                )}

                <TabsContent
                  value="details"
                  className={cn("mt-0 space-y-4", loading && "hidden")}
                >
                  <Field
                    form={form}
                    name="companyName"
                    label="Company name"
                    placeholder="Acme Roofing LLC"
                    required
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field form={form} name="ownerName" label="Owner name" />
                    <Field
                      form={form}
                      name="contactPerson"
                      label="Contact person"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      form={form}
                      name="email"
                      label="Email"
                      type="email"
                      placeholder="owner@acme.com"
                    />
                    <Field
                      form={form}
                      name="phone"
                      label="Phone"
                      placeholder="(516) 555-0142"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      form={form}
                      name="website"
                      label="Website"
                      placeholder="https://acme.com"
                    />
                    <Field
                      form={form}
                      name="businessCategory"
                      label="Business category"
                      placeholder="Roofing Contractor"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(ClientStatus).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {CLIENT_STATUS_LABELS[s]}
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
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(Priority).map((p) => (
                                <SelectItem key={p} value={p}>
                                  {PRIORITY_LABELS[p]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Tags */}
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="gap-1 pr-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() =>
                              form.setValue(
                                "tags",
                                tags.filter((t) => t !== tag),
                                { shouldDirty: true },
                              )
                            }
                            className="rounded-sm p-0.5 hover:bg-muted"
                            aria-label={`Remove ${tag}`}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                      placeholder="Type a tag and press Enter"
                      list="client-tag-suggestions"
                    />
                    <datalist id="client-tag-suggestions">
                      {allTags.map((t) => (
                        <option key={t.id} value={t.name} />
                      ))}
                    </datalist>
                  </FormItem>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={4}
                            placeholder="Anything the team should know…"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="address" className="mt-0 space-y-4">
                  <Field form={form} name="addressLine1" label="Address line 1" />
                  <Field form={form} name="addressLine2" label="Address line 2" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field form={form} name="city" label="City" />
                    <Field form={form} name="state" label="State" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field form={form} name="zipCode" label="ZIP code" />
                    <Field form={form} name="country" label="Country" />
                  </div>
                </TabsContent>

                <TabsContent value="social" className="mt-0 space-y-4">
                  <Field
                    form={form}
                    name="googleBusinessProfile"
                    label="Google Business Profile"
                    placeholder="https://maps.google.com/…"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field form={form} name="facebookUrl" label="Facebook" />
                    <Field form={form} name="instagramUrl" label="Instagram" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field form={form} name="linkedinUrl" label="LinkedIn" />
                    <Field form={form} name="youtubeUrl" label="YouTube" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field form={form} name="tiktokUrl" label="TikTok" />
                    <Field form={form} name="twitterUrl" label="X / Twitter" />
                  </div>
                  <Field form={form} name="logoUrl" label="Logo URL" />
                </TabsContent>

                <TabsContent value="commercial" className="mt-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      form={form}
                      name="monthlyRetainer"
                      label="Monthly retainer (USD)"
                      type="number"
                      placeholder="1500"
                    />
                    <FormField
                      control={form.control}
                      name="accountManagerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account manager</FormLabel>
                          <Select
                            value={field.value || "none"}
                            onValueChange={(v) =>
                              field.onChange(v === "none" ? "" : v)
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {managers.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name ?? "Unnamed"}
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
                    <Field
                      form={form}
                      name="startDate"
                      label="Start date"
                      type="date"
                    />
                    <Field
                      form={form}
                      name="renewalDate"
                      label="Renewal date"
                      type="date"
                    />
                  </div>

                  <FormItem>
                    <FormLabel>Services purchased</FormLabel>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {Object.values(ServiceType).map((service) => {
                        const checked = services.includes(service);
                        return (
                          <button
                            key={service}
                            type="button"
                            onClick={() =>
                              form.setValue(
                                "services",
                                checked
                                  ? services.filter((s) => s !== service)
                                  : [...services, service],
                                { shouldDirty: true },
                              )
                            }
                            className={cn(
                              "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                              checked
                                ? "border-primary bg-primary/10 font-medium"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            {SERVICE_LABELS[service]}
                          </button>
                        );
                      })}
                    </div>
                  </FormItem>
                </TabsContent>
              </div>
            </Tabs>

            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              {/* Submitting mid-load would save the placeholder defaults over
                  the real record. */}
              <Button type="submit" disabled={pending || loading}>
                {(pending || loading) && <Loader2 className="animate-spin" />}
                {loading
                  ? "Loading…"
                  : isEdit
                    ? "Save changes"
                    : "Create client"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

/** Thin wrapper over the common text-input field shape. */
function Field({
  form,
  name,
  label,
  type = "text",
  placeholder,
  required,
}: {
  form: ReturnType<typeof useForm<ClientFormValues>>;
  name: keyof ClientFormValues;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && <span className="ml-0.5 text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              {...field}
              value={
                typeof field.value === "string" || typeof field.value === "number"
                  ? field.value
                  : ""
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
