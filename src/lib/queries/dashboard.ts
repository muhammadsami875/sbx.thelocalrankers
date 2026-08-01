import {
  endOfMonth,
  endOfToday,
  startOfMonth,
  startOfToday,
  subMonths,
  format,
} from "date-fns";
import { prisma, notDeleted } from "@/lib/prisma";
import { percentChange } from "@/lib/utils";

/**
 * Dashboard aggregates.
 *
 * All figures come from real queries — nothing here is mocked. Revenue is
 * recognised from `Payment.paidAt` (cash received), not invoice totals, so the
 * KPI matches what actually landed in the bank.
 */

export type Kpi = {
  value: number;
  previous: number;
  change: number | null;
};

function kpi(value: number, previous: number): Kpi {
  return { value, previous, change: percentChange(value, previous) };
}

export async function getDashboardMetrics() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    revenueThisMonth,
    revenuePrevMonth,
    activeClients,
    activeClientsPrev,
    inactiveClients,
    pendingInvoices,
    overdueInvoices,
    tasksDueToday,
    upcomingMeetings,
    projectsRunning,
    leadsThisMonth,
    leadsPrevMonth,
    adsAggregate,
    gbpAggregate,
    mrrAggregate,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        ...notDeleted,
        status: "SUCCEEDED",
        paidAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        ...notDeleted,
        status: "SUCCEEDED",
        paidAt: { gte: prevStart, lte: prevEnd },
      },
    }),
    prisma.client.count({ where: { ...notDeleted, status: "ACTIVE" } }),
    prisma.client.count({
      where: { ...notDeleted, status: "ACTIVE", createdAt: { lt: monthStart } },
    }),
    prisma.client.count({
      where: { ...notDeleted, status: { in: ["INACTIVE", "PAUSED", "CHURNED"] } },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      _count: true,
      where: {
        ...notDeleted,
        status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
      },
    }),
    prisma.invoice.count({
      where: { ...notDeleted, status: "OVERDUE" },
    }),
    prisma.task.count({
      where: {
        ...notDeleted,
        status: { notIn: ["DONE", "CANCELLED"] },
        dueDate: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.meeting.count({
      where: {
        ...notDeleted,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startsAt: { gte: now },
      },
    }),
    prisma.project.count({
      where: { ...notDeleted, status: { in: ["IN_PROGRESS", "REVIEW"] } },
    }),
    prisma.lead.count({
      where: { ...notDeleted, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.lead.count({
      where: { ...notDeleted, createdAt: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.adsCampaign.aggregate({
      _sum: { cost: true, revenue: true, clicks: true, conversions: true, impressions: true },
      where: { ...notDeleted, status: "ACTIVE" },
    }),
    prisma.gbpInsight.aggregate({
      _sum: { totalReviews: true, searchViews: true, mapViews: true },
      _avg: { averageRating: true },
      where: { ...notDeleted, periodStart: { gte: subMonths(now, 1) } },
    }),
    prisma.subscription.aggregate({
      _sum: { amount: true },
      where: { ...notDeleted, status: "ACTIVE", interval: "MONTHLY" },
    }),
  ]);

  const revenue = Number(revenueThisMonth._sum.amount ?? 0);
  const revenuePrev = Number(revenuePrevMonth._sum.amount ?? 0);

  // Profit uses a configurable margin until the Expenses module lands in
  // Phase 2 — flagged so nobody mistakes it for a booked figure.
  const MARGIN = 0.42;
  const adsCost = Number(adsAggregate._sum.cost ?? 0);
  const adsRevenue = Number(adsAggregate._sum.revenue ?? 0);

  return {
    revenue: kpi(revenue, revenuePrev),
    profit: kpi(revenue * MARGIN, revenuePrev * MARGIN),
    profitIsEstimated: true,
    mrr: Number(mrrAggregate._sum.amount ?? 0),
    arr: Number(mrrAggregate._sum.amount ?? 0) * 12,
    activeClients: kpi(activeClients, activeClientsPrev),
    inactiveClients,
    pendingPayments: Number(pendingInvoices._sum.total ?? 0),
    pendingInvoiceCount: pendingInvoices._count,
    overdueInvoices,
    tasksDueToday,
    upcomingMeetings,
    projectsRunning,
    leads: kpi(leadsThisMonth, leadsPrevMonth),
    adsSpend: adsCost,
    adsClicks: adsAggregate._sum.clicks ?? 0,
    adsConversions: adsAggregate._sum.conversions ?? 0,
    adsImpressions: adsAggregate._sum.impressions ?? 0,
    roi: adsCost > 0 ? ((adsRevenue - adsCost) / adsCost) * 100 : 0,
    googleReviews: gbpAggregate._sum.totalReviews ?? 0,
    averageRating: Number(gbpAggregate._avg.averageRating ?? 0),
    gbpViews:
      (gbpAggregate._sum.searchViews ?? 0) + (gbpAggregate._sum.mapViews ?? 0),
  };
}

/** 12 months of collected revenue, for the dashboard area chart. */
export async function getRevenueSeries(months = 12) {
  const start = startOfMonth(subMonths(new Date(), months - 1));

  const payments = await prisma.payment.findMany({
    where: { ...notDeleted, status: "SUCCEEDED", paidAt: { gte: start } },
    select: { amount: true, paidAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < months; i++) {
    buckets.set(format(startOfMonth(subMonths(new Date(), months - 1 - i)), "yyyy-MM"), 0);
  }
  for (const p of payments) {
    if (!p.paidAt) continue;
    const key = format(p.paidAt, "yyyy-MM");
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + Number(p.amount));
    }
  }

  return [...buckets.entries()].map(([key, revenue]) => ({
    month: format(new Date(`${key}-01T00:00:00`), "MMM"),
    revenue: Math.round(revenue),
  }));
}

/** Leads created per month, split into won vs total. */
export async function getLeadSeries(months = 12) {
  const start = startOfMonth(subMonths(new Date(), months - 1));

  const leads = await prisma.lead.findMany({
    where: { ...notDeleted, createdAt: { gte: start } },
    select: { createdAt: true, status: true },
  });

  const buckets = new Map<string, { leads: number; won: number }>();
  for (let i = 0; i < months; i++) {
    buckets.set(
      format(startOfMonth(subMonths(new Date(), months - 1 - i)), "yyyy-MM"),
      { leads: 0, won: 0 },
    );
  }
  for (const lead of leads) {
    const key = format(lead.createdAt, "yyyy-MM");
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.leads += 1;
    if (lead.status === "WON") bucket.won += 1;
  }

  return [...buckets.entries()].map(([key, v]) => ({
    month: format(new Date(`${key}-01T00:00:00`), "MMM"),
    ...v,
  }));
}

/**
 * Average tracked keyword position over time. Lower is better, so the chart
 * inverts its Y axis.
 */
export async function getSeoSeries(days = 90) {
  const since = new Date(Date.now() - days * 86_400_000);

  const rankings = await prisma.seoRanking.findMany({
    where: { capturedAt: { gte: since }, position: { not: null } },
    select: { position: true, capturedAt: true },
    orderBy: { capturedAt: "asc" },
  });

  const buckets = new Map<string, { total: number; count: number }>();
  for (const r of rankings) {
    const key = format(r.capturedAt, "yyyy-MM-dd");
    const bucket = buckets.get(key) ?? { total: 0, count: 0 };
    bucket.total += r.position ?? 0;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      date: format(new Date(`${key}T00:00:00`), "MMM d"),
      position: Number((v.total / v.count).toFixed(1)),
    }));
}

export async function getRecentActivity(limit = 8) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      summary: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}

export async function getUpcomingRenewals(limit = 5) {
  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 86_400_000);

  return prisma.client.findMany({
    where: {
      ...notDeleted,
      status: "ACTIVE",
      renewalDate: { gte: now, lte: in60Days },
    },
    orderBy: { renewalDate: "asc" },
    take: limit,
    select: {
      id: true,
      companyName: true,
      renewalDate: true,
      monthlyRetainer: true,
    },
  });
}

export async function getDueInvoices(limit = 5) {
  return prisma.invoice.findMany({
    where: {
      ...notDeleted,
      status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      amountPaid: true,
      dueDate: true,
      status: true,
      client: { select: { id: true, companyName: true } },
    },
  });
}
