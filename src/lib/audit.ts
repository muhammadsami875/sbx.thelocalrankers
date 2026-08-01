import { headers } from "next/headers";
import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Audit logging.
 *
 * The spec requires every mutation to record who/when/old/new plus IP and
 * browser. Writes are deliberately best-effort: an audit failure must never
 * roll back the business operation that succeeded.
 */

type Primitive = string | number | boolean | Date | null | undefined;

/** Field-level diff, skipping unchanged values and internal columns. */
export function diff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Prisma.JsonObject {
  const changes: Prisma.JsonObject = {};
  const ignored = new Set(["updatedAt", "createdAt", "updatedById", "createdById"]);
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  for (const key of keys) {
    if (ignored.has(key)) continue;
    const from = before?.[key];
    const to = after?.[key];
    if (serialize(from) === serialize(to)) continue;
    changes[key] = {
      from: serialize(from),
      to: serialize(to),
    } as Prisma.JsonObject;
  }
  return changes;
}

function serialize(value: unknown): Primitive {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value as Primitive;
}

async function requestContext() {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return {
      ipAddress: forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
      userAgent: h.get("user-agent"),
    };
  } catch {
    // headers() throws outside a request scope (e.g. the seed script).
    return { ipAddress: null, userAgent: null };
  }
}

export async function recordAudit(input: {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  try {
    const { ipAddress, userAgent } = await requestContext();
    const changes =
      input.before || input.after ? diff(input.before ?? null, input.after ?? null) : undefined;

    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        changes: changes && Object.keys(changes).length > 0 ? changes : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", error);
  }
}
