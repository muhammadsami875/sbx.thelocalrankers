import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/page-header";
import { ClientsTable } from "@/components/clients/clients-table";
import {
  getAllTags,
  getAssignableManagers,
  getClients,
} from "@/lib/queries/clients";
import { clientListParamsSchema } from "@/lib/validations/client";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const role = session?.user.role;

  const raw = await searchParams;
  // Unknown/garbage params fall back to defaults rather than 500ing.
  const parsed = clientListParamsSchema.safeParse(raw);
  const params = parsed.success ? parsed.data : clientListParamsSchema.parse({});

  const [result, managers, tags] = await Promise.all([
    getClients(params),
    getAssignableManagers(),
    getAllTags(),
  ]);

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          result.total === 1
            ? "1 client in the book"
            : `${result.total} clients in the book`
        }
      />

      <ClientsTable
        data={result.rows}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
        pageCount={result.pageCount}
        managers={managers}
        allTags={tags}
        canCreate={can(role, "clients:create")}
        canUpdate={can(role, "clients:update")}
        canDelete={can(role, "clients:delete")}
        canExport={can(role, "clients:export")}
      />
    </>
  );
}
