import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  hint,
  /** Set when a lower number is the better outcome (e.g. overdue invoices). */
  invertTrend = false,
  accent = "primary",
}: {
  label: string;
  value: string;
  change?: number | null;
  icon: LucideIcon;
  hint?: string;
  invertTrend?: boolean;
  accent?: "primary" | "accent" | "warning" | "destructive";
}) {
  const hasChange = change != null && Number.isFinite(change);
  const rounded = hasChange ? Math.round(change * 10) / 10 : 0;
  const isFlat = !hasChange || rounded === 0;
  const isUp = rounded > 0;
  // "Good" depends on the metric, not the direction of the arrow.
  const isGood = invertTrend ? !isUp : isUp;

  const TrendIcon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;

  const accentClass = {
    primary: "bg-primary/12 text-primary",
    accent: "bg-accent/12 text-accent",
    warning: "bg-warning/12 text-warning",
    destructive: "bg-destructive/12 text-destructive",
  }[accent];

  const card = (
    <Card className="group relative overflow-hidden p-5 transition-shadow duration-200 hover:shadow-soft-lg">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            accentClass,
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>

      <p className="tabular mt-3 font-display text-2xl font-semibold tracking-tight">
        {value}
      </p>

      {hasChange ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-semibold",
              isFlat
                ? "bg-muted text-muted-foreground"
                : isGood
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive",
            )}
          >
            <TrendIcon className="size-3" />
            {Math.abs(rounded)}%
          </span>
          <span className="text-xs text-muted-foreground">vs last month</span>
        </div>
      ) : (
        hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      )}
    </Card>
  );

  if (hasChange && hint) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    );
  }

  return card;
}
