"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma, notDeleted } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { requirePermission, PermissionError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

export type RetainerResult =
  | { ok: true; amount: number }
  | { ok: false; error: string };

/**
 * Sets a client's monthly retainer directly.
 *
 * This is the number MRR is summed from, so it updates the moment this saves.
 * Any active monthly subscription for the client is kept in step, otherwise the
 * subscription would later overwrite this value.
 */
export async function setClientRetainer(
  clientId: string,
  amount: number,
): Promise<RetainerResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "clients:update");

    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, error: "Enter an amount of zero or more." };
    }
    if (amount > 100_000_000) {
      return { ok: false, error: "That amount looks too large." };
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, ...notDeleted },
      select: { id: true, companyName: true, monthlyRetainer: true },
    });
    if (!client) return { ok: false, error: "That client no longer exists." };

    const rounded = Math.round(amount * 100) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: clientId },
        data: {
          monthlyRetainer: new Prisma.Decimal(rounded),
          updatedById: session.user.id,
        },
      });

      // Keep the recurring package aligned so it can't clobber this later.
      await tx.subscription.updateMany({
        where: {
          clientId,
          deletedAt: null,
          status: "ACTIVE",
          interval: "MONTHLY",
        },
        data: { amount: new Prisma.Decimal(rounded) },
      });
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Client",
      entityId: clientId,
      summary: `set ${client.companyName} retainer to ${rounded}`,
      before: { monthlyRetainer: Number(client.monthlyRetainer ?? 0) },
      after: { monthlyRetainer: rounded },
    });

    revalidatePath("/payments");
    revalidatePath("/dashboard");
    revalidatePath("/subscriptions");
    revalidatePath("/clients");
    revalidatePath(`/clients/${clientId}`);

    return { ok: true, amount: rounded };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { ok: false, error: "Your session expired. Please sign in again." };
    }
    console.error("[retainer] action failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
