"use server";

import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getInvoiceById, type InvoiceDetail } from "@/lib/queries/billing";

/**
 * Loads a full invoice (with line items) for the edit form.
 *
 * Lives in its own "use server" module because a server-action file may only
 * export async functions, and the page also needs to pass this down to a
 * client component.
 */
export async function loadInvoice(id: string): Promise<InvoiceDetail | null> {
  const session = await requireSession();
  requirePermission(session.user.role, "invoices:update");
  return getInvoiceById(id);
}
