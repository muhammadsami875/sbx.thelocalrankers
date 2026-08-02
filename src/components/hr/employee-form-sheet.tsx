"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { EmploymentType, UserRole } from "@prisma/client";
import { toast } from "sonner";
import { employeeSchema, type EmployeeFormValues } from "@/lib/validations/hr";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatMoney } from "@/lib/payroll";
import type { EmployeeRow } from "@/lib/queries/hr";
import { createEmployee, updateEmployee } from "@/app/(app)/employees/actions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const EMPTY: EmployeeFormValues = {
  name: "",
  email: "",
  password: "",
  role: "READ_ONLY",
  employeeNumber: "",
  designation: "",
  department: "",
  employmentType: "FULL_TIME",
  hireDate: format(new Date(), "yyyy-MM-dd"),
  baseSalary: "" as unknown as number,
  currency: "PKR",
  commissionRate: 0,
  shiftStart: "09:00",
  shiftEnd: "18:00",
  workingDaysOverride: "",
  phone: "",
};

export function EmployeeFormSheet({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeRow;
}) {
  const router = useRouter();
  const isEdit = !!employee;
  const [pending, setPending] = React.useState(false);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: EMPTY,
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      employee
        ? {
            ...EMPTY,
            name: employee.user.name ?? "",
            email: employee.user.email ?? "",
            password: "",
            role: employee.user.role,
            employeeNumber: employee.employeeNumber ?? "",
            designation: employee.designation ?? "",
            department: employee.department ?? "",
            employmentType: employee.employmentType,
            hireDate: employee.hireDate
              ? format(employee.hireDate, "yyyy-MM-dd")
              : "",
            baseSalary: employee.baseSalary,
            currency: employee.currency,
            commissionRate: employee.commissionRate,
            shiftStart: employee.shiftStart,
            shiftEnd: employee.shiftEnd,
          }
        : EMPTY,
    );
  }, [open, employee, form]);

  const salary = Number(form.watch("baseSalary")) || 0;
  const currency = form.watch("currency") || "PKR";
  const rate = Number(form.watch("commissionRate")) || 0;
  // Illustrative only — real payroll uses the actual month's weekday count.
  const perDay = salary > 0 ? salary / 22 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit employee" : "New employee"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update pay, shift and access. Leave the password blank to keep the current one."
              : "Creates a login and an employee record together, so they can clock in immediately."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setPending(true);
              const result = isEdit
                ? await updateEmployee(employee.id, values)
                : await createEmployee(values);
              setPending(false);

              if (!result.ok) {
                if (result.fieldErrors) {
                  for (const [field, messages] of Object.entries(result.fieldErrors)) {
                    form.setError(field as keyof EmployeeFormValues, {
                      message: messages[0],
                    });
                  }
                }
                toast.error(result.error);
                return;
              }
              toast.success(
                isEdit ? `${values.name} updated` : `${values.name} added`,
              );
              onOpenChange(false);
              router.refresh();
            })}
            className="flex min-h-0 flex-1 flex-col"
          >
            <Tabs defaultValue="person" className="flex min-h-0 flex-1 flex-col">
              <div className="px-6 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="person" className="flex-1">
                    Person
                  </TabsTrigger>
                  <TabsTrigger value="pay" className="flex-1">
                    Pay
                  </TabsTrigger>
                  <TabsTrigger value="shift" className="flex-1">
                    Shift
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <TabsContent value="person" className="mt-0 space-y-4">
                  <Text form={form} name="name" label="Full name" placeholder="Abdul Wadood" required />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Text form={form} name="email" label="Email" type="email" placeholder="abdul@thelocalrankers.com" required />
                    <Text form={form} name="phone" label="Phone" />
                  </div>

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {isEdit ? "New password" : "Initial password"}
                          {!isEdit && <span className="ml-0.5 text-destructive">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder={isEdit ? "Leave blank to keep current" : "At least 8 characters"}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Share it with them directly and ask them to change it.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Text form={form} name="employeeNumber" label="Employee ID" placeholder="LR-012" />
                    <Text form={form} name="designation" label="Designation" placeholder="Cold Calling Agent" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Text form={form} name="department" label="Department" placeholder="Sales" />
                    <Text form={form} name="hireDate" label="Joining date" type="date" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Choice
                      form={form}
                      name="role"
                      label="System role"
                      options={Object.values(UserRole)
                        .filter((r) => r !== "CLIENT")
                        .map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                    />
                    <Choice
                      form={form}
                      name="employmentType"
                      label="Employment type"
                      options={Object.values(EmploymentType).map((t) => ({
                        value: t,
                        label: t.replace(/_/g, " ").toLowerCase(),
                      }))}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="pay" className="mt-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                    <Text form={form} name="baseSalary" label="Monthly base salary" type="number" placeholder="50000" required />
                    <Text form={form} name="currency" label="Currency" placeholder="PKR" />
                  </div>

                  <Text
                    form={form}
                    name="commissionRate"
                    label="Commission rate (%)"
                    type="number"
                    placeholder="6"
                  />

                  <FormField
                    control={form.control}
                    name="workingDaysOverride"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Working days override</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Leave blank to use the calendar"
                            {...field}
                            value={(field.value as string | number) ?? ""}
                          />
                        </FormControl>
                        <FormDescription>
                          By default working days are the Mon–Fri count for each
                          month, minus holidays. Set a number here only for staff
                          on a different schedule.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {salary > 0 && (
                    <div className="rounded-md border border-border bg-muted/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        How pay is calculated
                      </p>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Base salary</dt>
                          <dd className="tabular font-medium">
                            {formatMoney(salary, currency)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">
                            Per working day (÷22 example)
                          </dt>
                          <dd className="tabular font-medium">
                            {formatMoney(perDay, currency)}
                          </dd>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                          <dt className="text-muted-foreground">
                            Commission on a {formatMoney(100000, currency)} deal
                          </dt>
                          <dd className="tabular font-semibold text-success">
                            {formatMoney((100000 * rate) / 100, currency)}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Each absent day deducts one per-day rate. Late arrivals
                        are flagged but never deducted.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="shift" className="mt-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Text form={form} name="shiftStart" label="Shift starts" placeholder="09:00" />
                    <Text form={form} name="shiftEnd" label="Shift ends" placeholder="18:00" />
                  </div>
                  <p className="rounded-md border border-border bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
                    Clocking in after the shift start is recorded as{" "}
                    <span className="font-medium text-foreground">Late</span> and
                    shown in reports, but does not reduce pay. Saturdays and
                    Sundays are non-working days and are never counted as
                    absences.
                  </p>
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
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {isEdit ? "Save changes" : "Create employee"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

function Text({
  form,
  name,
  label,
  type = "text",
  placeholder,
  required,
}: {
  form: ReturnType<typeof useForm<EmployeeFormValues>>;
  name: keyof EmployeeFormValues;
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

function Choice({
  form,
  name,
  label,
  options,
}: {
  form: ReturnType<typeof useForm<EmployeeFormValues>>;
  name: keyof EmployeeFormValues;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={String(field.value ?? "")} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} className="capitalize">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
