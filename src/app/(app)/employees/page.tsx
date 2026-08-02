import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getEmployees } from "@/lib/queries/hr";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeesClient } from "@/components/hr/employees-client";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const [session, employees] = await Promise.all([auth(), getEmployees()]);
  const role = session!.user.role;

  return (
    <>
      <PageHeader
        title="Employees"
        description={
          employees.length === 1
            ? "1 employee on the payroll"
            : `${employees.length} employees on the payroll`
        }
      />

      <EmployeesClient
        employees={employees}
        canCreate={can(role, "employees:create")}
        canUpdate={can(role, "employees:update")}
        canDelete={can(role, "employees:delete")}
      />
    </>
  );
}
