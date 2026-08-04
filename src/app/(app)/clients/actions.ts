"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma, notDeleted } from "@/lib/prisma";
import {
  getAllTags,
  getAssignableManagers,
  getClientForForm,
} from "@/lib/queries/clients";
import { requireSession } from "@/lib/auth";
import { requirePermission, PermissionError } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { clientSchema, type ClientFormValues } from "@/lib/validations/client";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** "" → null, so empty inputs don't persist as empty strings. */
function nullify<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = value === "" ? null : value;
  }
  return out;
}

function toDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Company names collide (e.g. two "Elite Roofing"), so slugs get a suffix. */
async function uniqueSlug(companyName: string, excludeId?: string) {
  const base = slugify(companyName) || "client";
  let slug = base;
  let n = 1;
  while (
    await prisma.client.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

/**
 * Loads the full editable record for the edit form.
 *
 * The clients table row carries only the columns it displays; seeding the form
 * from it would blank every field it omits on save.
 */
export async function loadClientForForm(id: string) {
  const session = await requireSession();
  requirePermission(session.user.role, "clients:update");
  return getClientForForm(id);
}

/** Managers and tags for the form's pickers, fetched by the sheet itself. */
export async function loadClientFormOptions() {
  await requireSession();
  const [managers, tags] = await Promise.all([
    getAssignableManagers(),
    getAllTags(),
  ]);
  return { managers, tags };
}

export async function createClient(
  values: ClientFormValues,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "clients:create");

    const parsed = clientSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { services, tags, monthlyRetainer, startDate, renewalDate, ...rest } =
      parsed.data;

    const client = await prisma.client.create({
      data: {
        ...(nullify(rest) as Prisma.ClientCreateInput),
        slug: await uniqueSlug(parsed.data.companyName),
        monthlyRetainer:
          monthlyRetainer === "" || monthlyRetainer == null
            ? null
            : new Prisma.Decimal(monthlyRetainer),
        startDate: toDate(startDate),
        renewalDate: toDate(renewalDate),
        createdById: session.user.id,
        updatedById: session.user.id,
        services: {
          create: services.map((service) => ({ service })),
        },
        tags: {
          create: await connectTags(tags),
        },
      },
      select: { id: true, companyName: true },
    });

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Client",
      entityId: client.id,
      summary: `created client ${client.companyName}`,
      after: parsed.data as Record<string, unknown>,
    });

    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, id: client.id };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateClient(
  id: string,
  values: ClientFormValues,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "clients:update");

    const parsed = clientSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please correct the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const before = await prisma.client.findFirst({
      where: { id, ...notDeleted },
      include: { services: true, tags: true },
    });
    if (!before) return { ok: false, error: "That client no longer exists." };

    const { services, tags, monthlyRetainer, startDate, renewalDate, ...rest } =
      parsed.data;

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(nullify(rest) as Prisma.ClientUpdateInput),
        slug:
          before.companyName === parsed.data.companyName
            ? before.slug
            : await uniqueSlug(parsed.data.companyName, id),
        monthlyRetainer:
          monthlyRetainer === "" || monthlyRetainer == null
            ? null
            : new Prisma.Decimal(monthlyRetainer),
        startDate: toDate(startDate),
        renewalDate: toDate(renewalDate),
        updatedById: session.user.id,
        // Replace the join rows wholesale — simpler and safer than diffing.
        services: {
          deleteMany: {},
          create: services.map((service) => ({ service })),
        },
        tags: {
          deleteMany: {},
          create: await connectTags(tags),
        },
      },
      select: { id: true, companyName: true },
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Client",
      entityId: id,
      summary: `updated client ${updated.companyName}`,
      before: before as unknown as Record<string, unknown>,
      after: parsed.data as Record<string, unknown>,
    });

    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true, id };
  } catch (error) {
    return handleError(error);
  }
}

/** Soft delete — the row stays for audit and historical reporting. */
export async function deleteClient(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "clients:delete");

    const before = await prisma.client.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, companyName: true },
    });
    if (!before) return { ok: false, error: "That client no longer exists." };

    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: session.user.id },
    });

    await recordAudit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Client",
      entityId: id,
      summary: `archived client ${before.companyName}`,
    });

    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true, id };
  } catch (error) {
    return handleError(error);
  }
}

export async function bulkUpdateStatus(
  ids: string[],
  status: "ACTIVE" | "PAUSED" | "INACTIVE" | "CHURNED" | "ONBOARDING" | "LEAD",
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "clients:update");

    if (ids.length === 0) return { ok: false, error: "No clients selected." };

    await prisma.client.updateMany({
      where: { id: { in: ids }, ...notDeleted },
      data: { status, updatedById: session.user.id },
    });

    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "Client",
      summary: `set ${ids.length} client(s) to ${status.toLowerCase()}`,
    });

    revalidatePath("/clients");
    return { ok: true, id: ids[0]! };
  } catch (error) {
    return handleError(error);
  }
}

export async function bulkDeleteClients(ids: string[]): Promise<ActionResult> {
  try {
    const session = await requireSession();
    requirePermission(session.user.role, "clients:delete");

    if (ids.length === 0) return { ok: false, error: "No clients selected." };

    await prisma.client.updateMany({
      where: { id: { in: ids }, ...notDeleted },
      data: { deletedAt: new Date(), updatedById: session.user.id },
    });

    await recordAudit({
      userId: session.user.id,
      action: "DELETE",
      entity: "Client",
      summary: `archived ${ids.length} client(s)`,
    });

    revalidatePath("/clients");
    return { ok: true, id: ids[0]! };
  } catch (error) {
    return handleError(error);
  }
}

/** Creates any tag that doesn't exist yet, then returns join-row payloads. */
async function connectTags(names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const rows = await Promise.all(
    unique.map((name) =>
      prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
        select: { id: true },
      }),
    ),
  );
  return rows.map((tag) => ({ tagId: tag.id }));
}

function handleError(error: unknown): ActionResult {
  if (error instanceof PermissionError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, error: "Your session expired. Please sign in again." };
  }
  console.error("[clients] action failed", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}
