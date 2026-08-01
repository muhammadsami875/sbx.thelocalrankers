import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  DollarSign,
  FolderKanban,
  Megaphone,
  Star,
  TrendingUp,
  UserMinus,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  LeadGrowthChart,
  RevenueChart,
  SeoRankingChart,
} from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getDashboardMetrics,
  getDueInvoices,
  getLeadSeries,
  getRecentActivity,
  getRevenueSeries,
  getSeoSeries,
  getUpcomingRenewals,
} from "@/lib/queries/dashboard";
import { formatCurrency, formatNumber, formatPercent, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [
    metrics,
    revenueSeries,
    leadSeries,
    seoSeries,
    activity,
    renewals,
    dueInvoices,
  ] = await Promise.all([
    getDashboardMetrics(),
    getRevenueSeries(),
    getLeadSeries(),
    getSeoSeries(),
    getRecentActivity(),
    getUpcomingRenewals(),
    getDueInvoices(),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Agency performance for ${format(new Date(), "MMMM yyyy")}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard
          label="Revenue this month"
          value={formatCurrency(metrics.revenue.value)}
          change={metrics.revenue.change}
          icon={DollarSign}
          hint="Payments received, not invoiced totals"
        />
        <KpiCard
          label="Profit (est.)"
          value={formatCurrency(metrics.profit.value)}
          change={metrics.profit.change}
          icon={Wallet}
          accent="accent"
          hint="Estimated at a 42% margin until the Expenses module lands"
        />
        <KpiCard
          label="MRR"
          value={formatCurrency(metrics.mrr)}
          icon={TrendingUp}
          hint={`${formatCurrency(metrics.arr)} ARR`}
        />
        <KpiCard
          label="Active clients"
          value={formatNumber(metrics.activeClients.value)}
          change={metrics.activeClients.change}
          icon={Building2}
        />
        <KpiCard
          label="Inactive / churned"
          value={formatNumber(metrics.inactiveClients)}
          icon={UserMinus}
          accent="warning"
          hint="Paused, inactive or churned accounts"
        />
        <KpiCard
          label="Pending payments"
          value={formatCurrency(metrics.pendingPayments)}
          icon={CreditCard}
          accent={metrics.overdueInvoices > 0 ? "destructive" : "primary"}
          hint={`${metrics.pendingInvoiceCount} open · ${metrics.overdueInvoices} overdue`}
        />
        <KpiCard
          label="Tasks due today"
          value={formatNumber(metrics.tasksDueToday)}
          icon={ClipboardList}
          accent={metrics.tasksDueToday > 0 ? "warning" : "primary"}
        />
        <KpiCard
          label="Upcoming meetings"
          value={formatNumber(metrics.upcomingMeetings)}
          icon={CalendarClock}
          accent="accent"
        />
        <KpiCard
          label="Projects running"
          value={formatNumber(metrics.projectsRunning)}
          icon={FolderKanban}
        />
        <KpiCard
          label="Leads this month"
          value={formatNumber(metrics.leads.value)}
          change={metrics.leads.change}
          icon={TrendingUp}
          accent="accent"
        />
        <KpiCard
          label="Ads spend"
          value={formatCurrency(metrics.adsSpend)}
          icon={Megaphone}
          hint={`${formatNumber(metrics.adsClicks)} clicks · ${formatNumber(metrics.adsConversions)} conversions`}
        />
        <KpiCard
          label="Return on ad spend"
          value={formatPercent(metrics.roi, 0)}
          icon={TrendingUp}
          accent={metrics.roi >= 0 ? "primary" : "destructive"}
          hint="Revenue vs cost across active campaigns"
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <p className="text-sm text-muted-foreground">
              Payments collected over the last 12 months
            </p>
          </CardHeader>
          <CardContent className="pl-0">
            <RevenueChart data={revenueSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Google Business</CardTitle>
            <p className="text-sm text-muted-foreground">Last 30 days</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-baseline gap-2">
              <Star className="size-5 fill-warning text-warning" />
              <span className="tabular font-display text-3xl font-semibold">
                {metrics.averageRating.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                across {formatNumber(metrics.googleReviews)} reviews
              </span>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <Metric
                label="Profile views"
                value={formatNumber(metrics.gbpViews, true)}
              />
              <Metric
                label="Ad impressions"
                value={formatNumber(metrics.adsImpressions, true)}
              />
              <Metric
                label="Ad conversions"
                value={formatNumber(metrics.adsConversions)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Lead growth</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total leads vs closed-won, by month
            </p>
          </CardHeader>
          <CardContent className="pl-0">
            <LeadGrowthChart data={leadSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average SEO position</CardTitle>
            <p className="text-sm text-muted-foreground">
              All tracked keywords · 90 days
            </p>
          </CardHeader>
          <CardContent className="pl-0">
            {seoSeries.length > 0 ? (
              <SeoRankingChart data={seoSeries} />
            ) : (
              <EmptyState message="No ranking data captured yet." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming renewals</CardTitle>
            <p className="text-sm text-muted-foreground">Next 60 days</p>
          </CardHeader>
          <CardContent>
            {renewals.length === 0 ? (
              <EmptyState message="No renewals in the next 60 days." />
            ) : (
              <ul className="divide-y divide-border">
                {renewals.map((client) => (
                  <li key={client.id}>
                    <Link
                      href={`/clients/${client.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {client.companyName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {client.renewalDate
                            ? format(client.renewalDate, "MMM d, yyyy")
                            : "—"}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-sm font-medium">
                        {formatCurrency(Number(client.monthlyRetainer ?? 0))}
                        <span className="text-xs font-normal text-muted-foreground">
                          /mo
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices due</CardTitle>
            <p className="text-sm text-muted-foreground">Awaiting payment</p>
          </CardHeader>
          <CardContent>
            {dueInvoices.length === 0 ? (
              <EmptyState message="Everything is paid up." />
            ) : (
              <ul className="divide-y divide-border">
                {dueInvoices.map((invoice) => {
                  const outstanding =
                    Number(invoice.total) - Number(invoice.amountPaid);
                  return (
                    <li
                      key={invoice.id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {invoice.client.companyName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.invoiceNumber} · due{" "}
                          {format(invoice.dueDate, "MMM d")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-medium">
                          {formatCurrency(outstanding)}
                        </p>
                        <Badge
                          variant={
                            invoice.status === "OVERDUE" ? "danger" : "muted"
                          }
                          className="mt-0.5"
                        >
                          {invoice.status.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <p className="text-sm text-muted-foreground">
              Every change is logged
            </p>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState message="No activity recorded yet." />
            ) : (
              <ul className="space-y-3">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <Avatar className="size-7 shrink-0">
                      {entry.user?.image && (
                        <AvatarImage src={entry.user.image} alt="" />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {initials(entry.user?.name ?? entry.user?.email ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">
                          {entry.user?.name ?? "System"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {entry.summary ??
                            `${entry.action.toLowerCase()}d a ${entry.entity.toLowerCase()}`}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/80">
                        {formatDistanceToNow(entry.createdAt, {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="tabular text-sm font-semibold">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>
  );
}
