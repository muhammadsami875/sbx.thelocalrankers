import type { Metadata } from "next";
import { UserX } from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma, notDeleted } from "@/lib/prisma";
import { getEmployeeForUser, getSales, monthRange } from "@/lib/queries/hr";
import { formatMoney } from "@/lib/payroll";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/hr/month-picker";
import { SalesClient } from "@/components/hr/sales-client";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const role = session!.user.role;

  const employee = await getEmployeeForUser(session!.user.id);
  const { key } = monthRange(params.month);

  // Managers see the whole team's sales; everyone else sees only their own.
  const canSeeAll = can(role, "sales:update");

  const sales = await getSales({
    employeeId: canSeeAll ? undefined : employee?.id,
    period: params.month,
  });

  if (!employee && !canSeeAll) {
    return (
      <>
        <PageHeader title="Sales" />
        <Card>
          <CardContent className="py-16 text-center">
            <UserX className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Your account isn&apos;t linked to an employee record, so there&apos;s
              nowhere to log sales. Ask a Super Admin to create one.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const currency = employee?.currency ?? "PKR";
  const totalValue = sales.reduce((s, r) => s + r.amountConverted, 0);
  const totalCommission = sales
    .filter((s) => s.status === "APPROVED" || s.status === "PAID")
    .reduce((s, r) => s + r.commissionAmount, 0);
  const pendingCount = sales.filter((s) => s.status === "PENDING").length;

  // Reuse the most recent rate so the field isn't blank each time.
  const lastSale = await prisma.sale.findFirst({
    where: notDeleted,
    orderBy: { createdAt: "desc" },
    select: { exchangeRate: true },
  });

  return (
    <>
      <PageHeader
        title={canSeeAll ? "Sales" : "My sales"}
        description={
          canSeeAll
            ? "Team-wide closed deals and commission"
            : `Commission at ${Number(employee?.commissionRate ?? 0)}% of deal value`
        }
        actions={<MonthPicker value={key} />}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Deals closed" value={String(sales.length)} />
        <Tile label="Total value" value={formatMoney(totalValue, currency)} />
        <Tile
          label="Commission earned"
          value={formatMoney(totalCommission, currency)}
          hint={pendingCount > 0 ? `${pendingCount} pending approval` : undefined}
          accent
        />
      </div>

      <SalesClient
        sales={sales}
        commissionRate={Number(employee?.commissionRate ?? 0)}
        payrollCurrency={currency}
        defaultRate={Number(lastSale?.exchangeRate ?? 1)}
        canApprove={canSeeAll}
        showEmployee={canSeeAll}
      />
    </>
  );
}

function Tile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`tabular mt-2 font-display text-2xl font-semibold ${accent ? "text-success" : ""}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
