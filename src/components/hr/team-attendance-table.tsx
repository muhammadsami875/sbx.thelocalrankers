import Link from "next/link";
import { format } from "date-fns";
import { UsersRound } from "lucide-react";
import type { TeamAttendanceRow } from "@/lib/queries/hr";
import { formatDuration, formatMoney } from "@/lib/payroll";
import { initials } from "@/lib/utils";
import { ATTENDANCE_LABELS, ATTENDANCE_VARIANT } from "@/lib/validations/hr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Whole-team attendance for admins and managers. */
export function TeamAttendanceTable({ rows }: { rows: TeamAttendanceRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <UsersRound className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No employees yet. Create one under{" "}
            <Link href="/employees" className="text-accent hover:underline">
              Employees
            </Link>{" "}
            and they can start clocking in.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      present: acc.present + r.daysPresent,
      absent: acc.absent + r.daysAbsent,
      late: acc.late + r.lateCount,
      inToday: acc.inToday + (r.todayClockIn ? 1 : 0),
    }),
    { present: 0, absent: 0, late: 0, inToday: 0 },
  );

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="In today" value={`${totals.inToday} / ${rows.length}`} tone="success" />
        <Tile label="Present days" value={String(totals.present)} />
        <Tile
          label="Absent days"
          value={String(totals.absent)}
          tone={totals.absent > 0 ? "danger" : undefined}
        />
        <Tile
          label="Late arrivals"
          value={String(totals.late)}
          tone={totals.late > 0 ? "warning" : undefined}
        />
      </div>

      <Card>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Employee</TableHead>
                <TableHead>Today</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Working days</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Pay impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        {r.image && <AvatarImage src={r.image} alt="" />}
                        <AvatarFallback className="text-[10px]">
                          {initials(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name}</p>
                        {r.designation && (
                          <p className="truncate text-xs text-muted-foreground">
                            {r.designation}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.todayStatus ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant={ATTENDANCE_VARIANT[r.todayStatus]}>
                          {ATTENDANCE_LABELS[r.todayStatus]}
                        </Badge>
                        {r.todayClockIn && (
                          <span className="tabular text-xs text-muted-foreground">
                            {format(r.todayClockIn, "h:mm a")}
                            {r.todayClockOut &&
                              ` – ${format(r.todayClockOut, "h:mm a")}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="muted">Not in</Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {r.shiftStart}–{r.shiftEnd}
                  </TableCell>
                  <TableCell className="tabular">{r.workingDays}</TableCell>
                  <TableCell className="tabular font-medium text-success">
                    {r.daysPresent}
                  </TableCell>
                  <TableCell
                    className={`tabular font-medium ${r.daysAbsent > 0 ? "text-destructive" : ""}`}
                  >
                    {r.daysAbsent}
                  </TableCell>
                  <TableCell
                    className={`tabular ${r.lateCount > 0 ? "text-warning" : "text-muted-foreground"}`}
                  >
                    {r.lateCount}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {formatDuration(r.minutesWorked)}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {r.absenceDeduction > 0 ? (
                      <span className="font-medium text-destructive">
                        −{formatMoney(r.absenceDeduction, r.currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success" ? "text-success"
    : tone === "danger" ? "text-destructive"
    : tone === "warning" ? "text-warning"
    : "";
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`tabular mt-2 font-display text-2xl font-semibold ${toneClass}`}>
        {value}
      </p>
    </Card>
  );
}
