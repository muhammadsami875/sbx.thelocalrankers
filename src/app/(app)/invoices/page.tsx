import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  getBillingSummary,
  getClientOptions,
  getInvoices,
  getOpenInvoices,
} from "@/lib/queries/billing";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { InvoicesClient } from "@/components/billing/invoices-client";
import { Card } from "@/components/ui/card";
import { loadInvoice } from "./load";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const [session, invoices, clients, openInvoices, summary] = await Promise.all([
    auth(),
    getInvoices({}),
    getClientOptions(),
    getOpenInvoices(),
    getBillingSummary(),
  ]);

  const role = session!.user.role;

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Retainers, upsells and one-off work"
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Outstanding"
          value={formatCurrency(summary.outstanding)}
          hint={`${summary.openCount} open`}
        />
        <Tile
          label="Overdue"
          value={formatCurrency(summary.overdue)}
          hint={`${summary.overdueCount} past due`}
          tone={summary.overdue > 0 ? "danger" : undefined}
        />
        <Tile
          label="Collected this month"
          value={formatCurrency(summary.collectedThisMonth)}
          tone="success"
        />
        <Tile
          label="MRR"
          value={formatCurrency(summary.mrr)}
          hint={`${formatCurrency(summary.arr)} ARR`}
        />
      </div>

      <InvoicesClient
        invoices={invoices}
        clients={clients}
        openInvoices={openInvoices}
        loadInvoice={loadInvoice}
        canCreate={can(role, "invoices:create")}
        canUpdate={can(role, "invoices:update")}
        canDelete={can(role, "invoices:delete")}
        canRecordPayment={can(role, "payments:create")}
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
