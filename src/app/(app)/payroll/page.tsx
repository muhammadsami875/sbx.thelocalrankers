import type { Metadata } from "next";
import { AlertTriangle, UserX } from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  computePayroll,
  getEmployeeForUser,
  getEmployees,
  monthRange,
} from "@/lib/queries/hr";
import { formatMoney } from "@/lib/payroll";
import { formatDateOnly } from "@/lib/date-only";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/hr/month-picker";
import { EmployeePicker } from "@/components/hr/employee-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Payroll" };

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; employee?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const role = session!.user.role;
  const canSeeAll = can(role, "payroll:update");

  const { key, start } = monthRange(params.month);

  // Managers/accountants pick any employee; everyone else sees only themselves.
  const own = await getEmployeeForUser(session!.user.id);
  const employees = canSeeAll ? await getEmployees() : [];
  const targetId = canSeeAll ? (params.employee ?? employees[0]?.id) : own?.id;

  if (!targetId) {
    return (
      <>
        <PageHeader title="Payroll" />
        <Card>
          <CardContent className="py-16 text-center">
            <UserX className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {canSeeAll
                ? "No employees exist yet. Create one under Employees."
                : "Your account isn't linked to an employee record."}
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const payroll = await computePayroll(targetId, params.month);

  if (!payroll.ok) {
    return (
      <>
        <PageHeader title="Payroll" />
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {payroll.reason}
          </CardContent>
        </Card>
      </>
    );
  }

  const { employee, result, salesTotal, salesCount } = payroll;
  const currency = employee.currency;

  return (
    <>
      <PageHeader
        title="Payroll"
        description={`${employee.user.name ?? ""}${employee.designation ? ` · ${employee.designation}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canSeeAll && (
              <EmployeePicker
                employees={employees.map((e) => ({
                  id: e.id,
                  name: e.user.name ?? e.user.email ?? "Unnamed",
                }))}
                value={targetId}
              />
            )}
            <MonthPicker value={key} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Payslip */}
        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Payslip — {formatDateOnly(start, { month: "long", year: "numeric" })}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {employee.employeeNumber ?? "No employee ID"} ·{" "}
                  {employee.user.email}
                </p>
              </div>
              <Badge variant="muted">Preview</Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <dl className="space-y-3 text-sm">
              <Line
                label="Base salary"
                value={formatMoney(result.baseSalary, currency)}
              />
              <Line
                label={`Per working day (÷ ${result.workingDays})`}
                value={formatMoney(result.perDayRate, currency)}
                muted
              />

              <div className="border-t border-border pt-3" />

              <Line
                label={`Absence deduction — ${result.daysAbsent} day${result.daysAbsent === 1 ? "" : "s"}`}
                value={
                  result.absenceDeduction.isZero()
                    ? formatMoney(0, currency)
                    : `− ${formatMoney(result.absenceDeduction, currency)}`
                }
                tone={result.absenceDeduction.isZero() ? undefined : "danger"}
              />
              {!result.otherDeductions.isZero() && (
                <Line
                  label="Other deductions"
                  value={`− ${formatMoney(result.otherDeductions, currency)}`}
                  tone="danger"
                />
              )}

              <Line
                label="Salary after deductions"
                value={formatMoney(
                  result.baseSalary
                    .minus(result.absenceDeduction)
                    .minus(result.otherDeductions),
                  currency,
                )}
                strong
              />

              <div className="border-t border-border pt-3" />

              <Line
                label={`Sales closed — ${salesCount} deal${salesCount === 1 ? "" : "s"}`}
                value={formatMoney(salesTotal, currency)}
                muted
              />
              <Line
                label={`Commission @ ${Number(employee.commissionRate)}%`}
                value={`+ ${formatMoney(result.commissionTotal, currency)}`}
                tone={result.commissionTotal.isZero() ? undefined : "success"}
              />
              {!result.bonus.isZero() && (
                <Line
                  label="Bonus"
                  value={`+ ${formatMoney(result.bonus, currency)}`}
                  tone="success"
                />
              )}
            </dl>

            <div className="mt-5 flex items-center justify-between rounded-md bg-primary/10 px-4 py-4">
              <span className="font-display font-semibold">Net pay</span>
              <span className="tabular font-display text-2xl font-semibold">
                {formatMoney(result.netPay, currency)}
              </span>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Working days are the Mon–Fri count for this month minus company
              holidays. Only days with no clock-in deduct pay; late arrivals are
              recorded but never deducted. Only approved sales earn commission.
            </p>
          </CardContent>
        </Card>

        {/* Attendance basis */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance basis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Working days" value={result.workingDays} />
              <Row label="Present" value={result.daysPresent} tone="success" />
              <Row
                label="Absent"
                value={result.daysAbsent}
                tone={result.daysAbsent > 0 ? "danger" : undefined}
              />
              <Row label="On leave (paid)" value={result.daysLeave} />
              <Row label="Holidays" value={result.daysHoliday} />
              <Row
                label="Late arrivals"
                value={result.lateCount}
                tone={result.lateCount > 0 ? "warning" : undefined}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Shift" value={`${employee.shiftStart}–${employee.shiftEnd}`} />
              <Row
                label="Base salary"
                value={formatMoney(employee.baseSalary ?? 0, currency)}
              />
              <Row
                label="Commission rate"
                value={`${Number(employee.commissionRate)}%`}
              />
              {employee.workingDaysOverride && (
                <Row
                  label="Working days override"
                  value={employee.workingDaysOverride}
                />
              )}
            </CardContent>
          </Card>

          {result.daysAbsent > 0 && (
            <Card className="border-warning/30 bg-warning/5 p-4">
              <div className="flex gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {result.daysAbsent} working{" "}
                  {result.daysAbsent === 1 ? "day has" : "days have"} no clock-in
                  recorded. If that&apos;s wrong, the employee should mark
                  attendance, or an admin can record approved leave so the day
                  isn&apos;t deducted.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Line({
  label,
  value,
  tone,
  muted,
  strong,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
  muted?: boolean;
  strong?: boolean;
}) {
  const toneClass =
    tone === "danger" ? "text-destructive"
    : tone === "success" ? "text-success"
    : "";
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-muted-foreground" : ""}>{label}</dt>
      <dd
        className={`tabular whitespace-nowrap ${strong ? "font-semibold" : "font-medium"} ${toneClass}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success" ? "text-success"
    : tone === "danger" ? "text-destructive"
    : tone === "warning" ? "text-warning"
    : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`tabular text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}
