"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils";

const AXIS = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const GRID = {
  stroke: "var(--color-border)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

/** Shared tooltip so all three charts read identically. */
function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  format: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-soft-lg">
      <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="tabular flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="capitalize">{entry.name}</span>
          <span className="ml-auto font-medium text-foreground">
            {format(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({
  data,
}: {
  data: { month: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="month" {...AXIS} />
        <YAxis
          {...AXIS}
          width={56}
          tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
        />
        <Tooltip
          content={<ChartTooltip format={(v) => formatCurrency(v)} />}
          cursor={{ stroke: "var(--color-border)" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#revenueFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LeadGrowthChart({
  data,
}: {
  data: { month: string; leads: number; won: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="month" {...AXIS} />
        <YAxis {...AXIS} width={40} allowDecimals={false} />
        <Tooltip
          content={<ChartTooltip format={(v) => formatNumber(v)} />}
          cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
        />
        <Bar
          dataKey="leads"
          fill="var(--color-chart-2)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="won"
          fill="var(--color-chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SeoRankingChart({
  data,
}: {
  data: { date: string; position: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" {...AXIS} minTickGap={28} />
        {/* Rank 1 is best, so the axis is reversed — up means improving. */}
        <YAxis {...AXIS} width={36} reversed domain={[1, "dataMax + 2"]} />
        <Tooltip
          content={<ChartTooltip format={(v) => `Position ${v}`} />}
          cursor={{ stroke: "var(--color-border)" }}
        />
        <Line
          type="monotone"
          dataKey="position"
          stroke="var(--color-chart-3)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
