import type { Prisma } from "@prisma/client";
import { prisma, notDeleted } from "@/lib/prisma";
import type { ClientListParams } from "@/lib/validations/client";

/** Paginated, filtered client list backing the TanStack table. */
export async function getClients(params: ClientListParams) {
  const { q, status, priority, accountManagerId, sort, dir, page, perPage } =
    params;

  const where: Prisma.ClientWhereInput = {
    ...notDeleted,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(accountManagerId ? { accountManagerId } : {}),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q, mode: "insensitive" } },
            { ownerName: { contains: q, mode: "insensitive" } },
            { contactPerson: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { businessCategory: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        companyName: true,
        ownerName: true,
        email: true,
        phone: true,
        website: true,
        city: true,
        state: true,
        businessCategory: true,
        status: true,
        priority: true,
        monthlyRetainer: true,
        renewalDate: true,
        startDate: true,
        createdAt: true,
        accountManager: { select: { id: true, name: true, image: true } },
        services: {
          where: { isActive: true, deletedAt: null },
          select: { service: true },
        },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        _count: {
          select: {
            projects: { where: { deletedAt: null } },
            invoices: { where: { deletedAt: null } },
          },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      ...row,
      monthlyRetainer: row.monthlyRetainer ? Number(row.monthlyRetainer) : null,
      services: row.services.map((s) => s.service),
      tags: row.tags.map((t) => t.tag),
    })),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export type ClientListRow = Awaited<ReturnType<typeof getClients>>["rows"][number];

export async function getClientById(id: string) {
  const client = await prisma.client.findFirst({
    where: { id, ...notDeleted },
    include: {
      accountManager: {
        select: { id: true, name: true, email: true, image: true, role: true },
      },
      contacts: { where: notDeleted, orderBy: { isPrimary: "desc" } },
      services: { where: notDeleted, orderBy: { service: "asc" } },
      tags: { include: { tag: true } },
      projects: {
        where: notDeleted,
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          progress: true,
          dueDate: true,
          budget: true,
        },
      },
      tasks: {
        where: { ...notDeleted, status: { notIn: ["DONE", "CANCELLED"] } },
        orderBy: { dueDate: "asc" },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignee: { select: { id: true, name: true, image: true } },
        },
      },
      invoices: {
        where: notDeleted,
        orderBy: { issueDate: "desc" },
        take: 20,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          amountPaid: true,
          issueDate: true,
          dueDate: true,
        },
      },
      files: {
        where: notDeleted,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          url: true,
          category: true,
          sizeBytes: true,
          createdAt: true,
          uploadedBy: { select: { name: true } },
        },
      },
      users: {
        where: notDeleted,
        select: { id: true, name: true, email: true, image: true, role: true },
      },
      _count: {
        select: {
          projects: { where: { deletedAt: null } },
          tasks: { where: { deletedAt: null } },
          invoices: { where: { deletedAt: null } },
          files: { where: { deletedAt: null } },
          seoKeywords: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!client) return null;

  // Team = everyone assigned to any of this client's projects.
  const team = await prisma.user.findMany({
    where: {
      deletedAt: null,
      projectMembers: { some: { project: { clientId: id, deletedAt: null } } },
    },
    select: { id: true, name: true, email: true, image: true, role: true },
  });

  const activity = await prisma.auditLog.findMany({
    where: { entity: "Client", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      action: true,
      summary: true,
      changes: true,
      createdAt: true,
      ipAddress: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return { ...client, team, activity };
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClientById>>>;

/**
 * The complete editable field set for one client.
 *
 * The list query deliberately selects only what the table renders, so a row
 * from it must never be used to seed the edit form — any field it omits would
 * be written back as empty and silently wipe the stored value.
 */
export async function getClientForForm(id: string) {
  const client = await prisma.client.findFirst({
    where: { id, ...notDeleted },
    select: {
      id: true,
      companyName: true,
      ownerName: true,
      contactPerson: true,
      email: true,
      phone: true,
      website: true,
      businessCategory: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zipCode: true,
      country: true,
      googleBusinessProfile: true,
      facebookUrl: true,
      instagramUrl: true,
      linkedinUrl: true,
      youtubeUrl: true,
      tiktokUrl: true,
      twitterUrl: true,
      logoUrl: true,
      notes: true,
      status: true,
      priority: true,
      monthlyRetainer: true,
      startDate: true,
      renewalDate: true,
      accountManagerId: true,
      services: {
        where: { isActive: true, deletedAt: null },
        select: { service: true },
      },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  if (!client) return null;

  return {
    ...client,
    monthlyRetainer: client.monthlyRetainer ? Number(client.monthlyRetainer) : null,
    services: client.services.map((s) => s.service),
    tags: client.tags.map((t) => t.tag.name),
  };
}

export type ClientFormRecord = NonNullable<
  Awaited<ReturnType<typeof getClientForForm>>
>;

/** Account managers available in the client form's assignee picker. */
export async function getAssignableManagers() {
  return prisma.user.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      role: {
        in: ["SUPER_ADMIN", "AGENCY_MANAGER", "MARKETING_MANAGER"],
      },
    },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  });
}

export async function getAllTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
}
