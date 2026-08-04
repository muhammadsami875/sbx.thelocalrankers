import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  EXPENSE_CATEGORY_LABELS,
  expenseMonthRange,
  getExpenses,
  getExpenseSummary,
} from "@/lib/queries/expenses";
import { getMonthlyRevenue } from "@/lib/queries/billing";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/hr/month-picker";
import { ExpensesClient } from "@/components/billing/expenses-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const role = session!.user.role;
  const { key } = expenseMonthRange(params.month);

  const [expenses, summary, revenue] = await Promise.all([
    getExpenses({ period: params.month }),
    getExpenseSummary(params.month),
    getMonthlyRevenue(params.month),
  ]);

  const profit = revenue - summary.total;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const topCategories = Object.entries(summary.categories)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Everything going out — profit is revenue minus this"
        actions={<MonthPicker value={key} />}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Revenue" value={formatCurrency(revenue)} tone="success" />
        <Tile
          label="Total expenses"
          value={formatCurrency(summary.total)}
          hint={`${summary.count} recorded`}
          tone="danger"
        />
        <Tile
          label="Payroll cost"
          value={formatCurrency(summary.payrollTotal)}
          hint="Salary + commission"
        />
        <Tile
          label="Profit"
          value={formatCurrency(profit)}
          hint={revenue > 0 ? `${margin.toFixed(1)}% margin` : undefined}
          tone={profit >= 0 ? "success" : "danger"}
        />
      </div>

      {topCategories.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Where the money went</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topCategories.map(([cat, value]) => {
              const pct = summary.total > 0 ? (value / summary.total) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {EXPENSE_CATEGORY_LABELS[
                        cat as keyof typeof EXPENSE_CATEGORY_LABELS
                      ]}
                    </span>
                    <span className="tabular font-medium">
                      {formatCurrency(value)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <ExpensesClient
        expenses={expenses}
        period={key}
        canManage={can(role, "expenses:create")}
      />
    </>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "";
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`tabular mt-2 font-display text-2xl font-semibold ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
