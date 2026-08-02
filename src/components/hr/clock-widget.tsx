"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Clock, LogIn, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clockIn, clockOut } from "@/app/(app)/attendance/actions";
import { formatDuration } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ClockWidget({
  shiftStart,
  shiftEnd,
  todayClockIn,
  todayClockOut,
  minutesWorked,
  lateMinutes,
}: {
  shiftStart: string;
  shiftEnd: string;
  todayClockIn: Date | null;
  todayClockOut: Date | null;
  minutesWorked: number | null;
  lateMinutes: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);

  // Rendered only after mount — a server-rendered clock would immediately
  // disagree with the client and trip a hydration mismatch.
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isIn = !!todayClockIn && !todayClockOut;
  const isDone = !!todayClockIn && !!todayClockOut;

  // Ticks live while the shift is open, otherwise shows the recorded total.
  const elapsed =
    isIn && now
      ? Math.max(0, Math.round((now.getTime() - new Date(todayClockIn).getTime()) / 60000))
      : minutesWorked;

  async function run(action: typeof clockIn) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attendance
          </p>
          <p className="tabular mt-2 font-display text-2xl font-semibold">
            {now ? format(now, "h:mm:ss a") : "--:--:--"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Shift {shiftStart}–{shiftEnd}
            {now && ` · ${format(now, "EEEE, MMM d")}`}
          </p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent">
          <Clock className="size-4" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {todayClockIn && (
          <Badge variant="muted">
            In {format(new Date(todayClockIn), "h:mm a")}
          </Badge>
        )}
        {todayClockOut && (
          <Badge variant="muted">
            Out {format(new Date(todayClockOut), "h:mm a")}
          </Badge>
        )}
        {lateMinutes > 0 && (
          <Badge variant="warning">{lateMinutes} min late</Badge>
        )}
        {elapsed != null && elapsed > 0 && (
          <Badge variant={isIn ? "info" : "success"}>
            {formatDuration(elapsed)}
            {isIn && " so far"}
          </Badge>
        )}
      </div>

      <div className="mt-4">
        {isDone ? (
          <p className="rounded-md bg-success/10 px-3 py-2.5 text-center text-sm font-medium text-success">
            Shift complete for today
          </p>
        ) : isIn ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => run(clockOut)}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
            Clock out
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={() => run(clockIn)}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
            Mark present
          </Button>
        )}
      </div>
    </Card>
  );
}
