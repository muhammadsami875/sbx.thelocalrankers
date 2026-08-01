import type { Metadata } from "next";
import { format } from "date-fns";
import {
  CalendarClock,
  FolderKanban,
  Receipt,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma, notDeleted } from "@/lib/prisma";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = { title: "Your dashboard" };

export default async function PortalDashboard() {
  const session = await auth();
  const clientId = session?.user.clientId;

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Your account isn&apos;t linked to a client workspace yet. Please
            contact your account manager.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [client, projects, openInvoices, meetings, gbp, keywordCount, bestRank] =
    await Promise.all([
      prisma.client.findFirst({
        where: { id: clientId, ...notDeleted },
        select: { companyName: true, renewalDate: true, monthlyRetainer: true },
      }),
      prisma.project.findMany({
        where: { clientId, ...notDeleted, status: { notIn: ["CANCELLED"] } },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          progress: true,
          dueDate: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          clientId,
          ...notDeleted,
          status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          dueDate: true,
          status: true,
        },
      }),
      prisma.meeting.count({
        where: {
          clientId,
          ...notDeleted,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          startsAt: { gte: new Date() },
        },
      }),
      prisma.gbpInsight.findFirst({
        where: { clientId, ...notDeleted },
        orderBy: { periodStart: "desc" },
        select: {
          totalReviews: true,
          averageRating: true,
          searchViews: true,
          mapViews: true,
          phoneCalls: true,
          websiteClicks: true,
        },
      }),
      prisma.seoKeyword.count({ where: { clientId, ...notDeleted } }),
      prisma.seoRanking.findFirst({
        where: { keyword: { clientId, deletedAt: null }, position: { not: null } },
        orderBy: [{ capturedAt: "desc" }, { position: "asc" }],
        select: { position: true },
      }),
    ]);

  const outstanding = openInvoices.reduce(
    (sum, i) => sum + (Number(i.total) - Number(i.amountPaid)),
    0,
  );

  return (
    <>
      <PageHeader
        title={`Welcome back${client ? `, ${client.companyName}` : ""}`}
        description="Here's how your campaigns are performing."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active projects"
          value={formatNumber(
            projects.filter((p) => p.status === "IN_PROGRESS" || p.status === "REVIEW")
              .length,
          )}
          icon={FolderKanban}
        />
        <KpiCard
          label="Keywords tracked"
          value={formatNumber(keywordCount)}
          icon={Search}
          accent="accent"
          hint={bestRank?.position ? `Best position: #${bestRank.position}` : undefined}
        />
        <KpiCard
          label="Google rating"
          value={gbp?.averageRating ? Number(gbp.averageRating).toFixed(1) : "—"}
          icon={Star}
          accent="warning"
          hint={gbp ? `${formatNumber(gbp.totalReviews)} reviews` : undefined}
        />
        <KpiCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          icon={Receipt}
          accent={outstanding > 0 ? "destructive" : "primary"}
          hint={`${openInvoices.length} open invoice${openInvoices.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Campaign status</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No active projects yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {projects.map((p) => (
                  <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        {p.dueDate && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Target: {format(p.dueDate, "MMM d, yyyy")}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={p.progress} className="h-1.5 max-w-48" />
                          <span className="tabular text-xs text-muted-foreground">
                            {p.progress}%
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {p.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Google Business</CardTitle>
              <p className="text-sm text-muted-foreground">Latest month</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {gbp ? (
                <>
                  <Row label="Search views" value={formatNumber(gbp.searchViews, true)} />
                  <Row label="Map views" value={formatNumber(gbp.mapViews, true)} />
                  <Row label="Website clicks" value={formatNumber(gbp.websiteClicks)} />
                  <Row label="Phone calls" value={formatNumber(gbp.phoneCalls)} />
                </>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No insights yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row
                label="Upcoming meetings"
                value={formatNumber(meetings)}
                icon={CalendarClock}
              />
              {client?.monthlyRetainer && (
                <Row
                  label="Monthly plan"
                  value={formatCurrency(Number(client.monthlyRetainer))}
                  icon={TrendingUp}
                />
              )}
              {client?.renewalDate && (
                <Row
                  label="Renews"
                  value={format(client.renewalDate, "MMM d, yyyy")}
                  icon={CalendarClock}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {openInvoices.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Open invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {openInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {format(inv.dueDate, "MMM d, yyyy")}
                    </p>
                  </div>
                  <span className="tabular text-sm font-medium">
                    {formatCurrency(Number(inv.total) - Number(inv.amountPaid))}
                  </span>
                  <Badge
                    variant={inv.status === "OVERDUE" ? "danger" : "muted"}
                    className="shrink-0"
                  >
                    {inv.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </span>
      <span className="tabular text-sm font-semibold">{value}</span>
    </div>
  );
}
