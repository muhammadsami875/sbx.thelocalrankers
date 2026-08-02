"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Plus, UserMinus, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { EmployeeRow } from "@/lib/queries/hr";
import { formatMoney } from "@/lib/payroll";
import { ROLE_LABELS } from "@/lib/rbac";
import { initials } from "@/lib/utils";
import { deactivateEmployee } from "@/app/(app)/employees/actions";
import { EmployeeFormSheet } from "@/components/hr/employee-form-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EmployeesClient({
  employees,
  canCreate,
  canUpdate,
  canDelete,
}: {
  employees: EmployeeRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<EmployeeRow | null>(null);
  const [, startTransition] = React.useTransition();

  return (
    <>
      {canCreate && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New employee
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="px-0 pb-0">
          {employees.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">No employees yet.</p>
              {canCreate && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setCreating(true)}
                >
                  <Plus />
                  Add your first employee
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Employee</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Base salary</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          {e.user.image && <AvatarImage src={e.user.image} alt="" />}
                          <AvatarFallback className="text-[10px]">
                            {initials(e.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {e.designation ?? e.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {e.employeeNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{ROLE_LABELS[e.user.role]}</Badge>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap font-medium">
                      {formatMoney(e.baseSalary, e.currency)}
                      <span className="text-xs font-normal text-muted-foreground">
                        /mo
                      </span>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap">
                      {e.commissionRate > 0 ? (
                        <span className="font-medium text-success">
                          {e.commissionRate}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {e.shiftStart}–{e.shiftEnd}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {e.hireDate ? format(e.hireDate, "MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${e.user.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/payroll?employee=${e.id}`}>
                              <Wallet />
                              View payslip
                            </Link>
                          </DropdownMenuItem>
                          {canUpdate && (
                            <DropdownMenuItem onClick={() => setEditing(e)}>
                              <Pencil />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  if (
                                    !confirm(
                                      `Deactivate ${e.user.name}? Their login is disabled and they stop appearing in payroll, but past records are kept.`,
                                    )
                                  )
                                    return;
                                  startTransition(async () => {
                                    const r = await deactivateEmployee(e.id);
                                    if (r.ok) {
                                      toast.success(`${e.user.name} deactivated`);
                                      router.refresh();
                                    } else {
                                      toast.error(r.error);
                                    }
                                  });
                                }}
                              >
                                <UserMinus />
                                Deactivate
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canCreate && (
        <EmployeeFormSheet open={creating} onOpenChange={setCreating} />
      )}
      {canUpdate && editing && (
        <EmployeeFormSheet
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          employee={editing}
        />
      )}
    </>
  );
}
