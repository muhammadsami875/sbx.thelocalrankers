import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, notDeleted } from "@/lib/prisma";
import { can, scopeToClient } from "@/lib/rbac";

/** Global search backing the ⌘K palette. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }

  const { role, clientId } = session.user;
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const scope = scopeToClient(role, clientId);
  const like = { contains: q, mode: "insensitive" as const };
  const take = 5;

  const [clients, projects, invoices, tasks] = await Promise.all([
    can(role, "clients:read")
      ? prisma.client.findMany({
          where: {
            ...notDeleted,
            ...(scope.clientId ? { id: scope.clientId } : {}),
            OR: [
              { companyName: like },
              { ownerName: like },
              { email: like },
              { city: like },
            ],
          },
          select: { id: true, companyName: true, city: true, state: true },
          take,
          orderBy: { companyName: "asc" },
        })
      : [],

    can(role, "projects:read")
      ? prisma.project.findMany({
          where: {
            ...notDeleted,
            ...scope,
            OR: [{ name: like }, { description: like }],
          },
          select: {
            id: true,
            name: true,
            status: true,
            client: { select: { companyName: true } },
          },
          take,
          orderBy: { updatedAt: "desc" },
        })
      : [],

    can(role, "invoices:read")
      ? prisma.invoice.findMany({
          where: {
            ...notDeleted,
            ...scope,
            OR: [{ invoiceNumber: like }, { client: { companyName: like } }],
          },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            client: { select: { companyName: true } },
          },
          take,
          orderBy: { issueDate: "desc" },
        })
      : [],

    can(role, "tasks:read")
      ? prisma.task.findMany({
          where: { ...notDeleted, ...scope, title: like },
          select: {
            id: true,
            title: true,
            status: true,
            client: { select: { companyName: true } },
          },
          take,
          orderBy: { updatedAt: "desc" },
        })
      : [],
  ]);

  const results = [
    ...clients.map((c) => ({
      id: `client-${c.id}`,
      type: "client" as const,
      title: c.companyName,
      subtitle: [c.city, c.state].filter(Boolean).join(", ") || null,
      href: `/clients/${c.id}`,
    })),
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      type: "project" as const,
      title: p.name,
      subtitle: p.client?.companyName ?? null,
      href: `/projects/${p.id}`,
    })),
    ...invoices.map((i) => ({
      id: `invoice-${i.id}`,
      type: "invoice" as const,
      title: i.invoiceNumber,
      subtitle: `${i.client?.companyName ?? ""} · $${Number(i.total).toLocaleString()}`,
      href: `/invoices/${i.id}`,
    })),
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      type: "task" as const,
      title: t.title,
      subtitle: t.client?.companyName ?? null,
      href: `/tasks/${t.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
