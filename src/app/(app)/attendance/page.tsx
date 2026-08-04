import type { Metadata } from "next";
import { format } from "date-fns";
import { CalendarCheck, Clock, TrendingDown, UserX } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getAttendanceForMonth,
  getEmployeeForUser,
  getHolidays,
  getTeamAttendance,
  getTodayAttendance,
  monthRange,
} from "@/lib/queries/hr";
import { can } from "@/lib/rbac";
import { TeamAttendanceTable } from "@/components/hr/team-attendance-table";
import { calculatePayroll, formatDuration, type AttendanceDay } from "@/lib/payroll";
import { formatDateOnly } from "@/lib/date-only";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_VARIANT,
} from "@/lib/validations/hr";
import { PageHeader } from "@/components/layout/page-header";
import { ClockWidget } from "@/components/hr/clock-widget";
import { MonthPicker } from "@/components/hr/month-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const employee = await getEmployeeForUser(session!.user.id);

  // Admins and managers usually have no employee record of their own, so show
  // them the team instead of a dead end.
  const canSeeTeam = can(session!.user.role, "attendance:update");

  if (!employee) {
    const { key: teamKey, start: teamStart } = monthRange(params.month);

    if (!canSeeTeam) {
      return (
        <>
          <PageHeader title="Attendance" />
          <Card>
            <CardContent className="py-16 text-center">
              <UserX className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Your account isn&apos;t linked to an employee record yet, so
                there&apos;s nothing to clock in against.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask a Super Admin to create one under Employees.
              </p>
            </CardContent>
          </Card>
        </>
      );
    }

    const team = await getTeamAttendance(params.month);
    return (
      <>
        <PageHeader
          title="Team attendance"
          description={formatDateOnly(teamStart, { month: "long", year: "numeric" })}
          actions={<MonthPicker value={teamKey} />}
        />
        <TeamAttendanceTable rows={team} />
      </>
    );
  }

  const { start, key } = monthRange(params.month);
  const [today, rows, holidays] = await Promise.all([
    getTodayAttendance(employee.id),
    getAttendanceForMonth(employee.id, params.month),
    getHolidays(start, monthRange(params.month).end),
  ]);

  // Reuse the payroll engine so the counts on this page can never disagree
  // with the ones on the payslip.
  const summary = calculatePayroll({
    period: start,
    baseSalary: employee.baseSalary ?? 0,
    attendance: rows as AttendanceDay[],
    holidays: holidays.map((h) => h.date),
    workingDaysOverride: employee.workingDaysOverride,
  });

  const totalMinutes = rows.reduce((s, r) => s + (r.minutesWorked ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${employee.user.name ?? "You"}${employee.designation ? ` · ${employee.designation}` : ""}`}
        actions={<MonthPicker value={key} />}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <ClockWidget
            shiftStart={employee.shiftStart}
            shiftEnd={employee.shiftEnd}
            todayClockIn={today?.clockIn ?? null}
            todayClockOut={today?.clockOut ?? null}
            minutesWorked={today?.minutesWorked ?? null}
            lateMinutes={today?.lateMinutes ?? 0}
          />

          <Card>
            <CardHeader>
              <CardTitle>This month</CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatDateOnly(start, { month: "long", year: "numeric" })}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Stat icon={CalendarCheck} label="Working days" value={summary.workingDays} />
              <Stat icon={CalendarCheck} label="Present" value={summary.daysPresent} tone="success" />
              <Stat icon={UserX} label="Absent" value={summary.daysAbsent} tone={summary.daysAbsent > 0 ? "danger" : undefined} />
              <Stat icon={Clock} label="Late arrivals" value={summary.lateCount} tone={summary.lateCount > 0 ? "warning" : undefined} />
              <Stat icon={CalendarCheck} label="On leave" value={summary.daysLeave} />
              <div className="border-t border-border pt-3">
                <Stat icon={Clock} label="Hours logged" value={formatDuration(totalMinutes)} />
              </div>
            </CardContent>
          </Card>

          {summary.daysAbsent > 0 && (
            <Card className="border-destructive/30 bg-destructive/5 p-4">
              <div className="flex gap-2.5">
                <TrendingDown className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium">Pay impact</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary.daysAbsent} absent{" "}
                    {summary.daysAbsent === 1 ? "day" : "days"} × per-day rate
                    reduces this month&apos;s salary. Late arrivals are recorded
                    but never deducted.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily log</CardTitle>
            <p className="text-sm text-muted-foreground">
              Days with no record on a working day count as absent at payroll.
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {rows.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No attendance recorded this month yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead>Worked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {/* date-only value — formatting it in local time would
                            show the previous day west of UTC. */}
                        {formatDateOnly(r.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ATTENDANCE_VARIANT[r.status]}>
                          {ATTENDANCE_LABELS[r.status]}
                          {r.lateMinutes > 0 && ` · ${r.lateMinutes}m`}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular">
                        {r.clockIn ? format(r.clockIn, "h:mm a") : "—"}
                      </TableCell>
                      <TableCell className="tabular">
                        {r.clockOut ? format(r.clockOut, "h:mm a") : "—"}
                      </TableCell>
                      <TableCell className="tabular">
                        {formatDuration(r.minutesWorked)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
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
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className={`tabular text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}
