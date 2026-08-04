"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { ClientStatus, Priority } from "@prisma/client";
import { toast } from "sonner";
import { cn, formatCurrency, initials, toCsv } from "@/lib/utils";
import {
  CLIENT_STATUS_LABELS,
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABELS,
  SERVICE_LABELS,
  STATUS_BADGE_VARIANT,
} from "@/lib/validations/client";
import type { ClientListRow } from "@/lib/queries/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ClientFormSheet } from "@/components/clients/client-form-sheet";
import { bulkDeleteClients, bulkUpdateStatus, deleteClient } from "@/app/(app)/clients/actions";

type Manager = { id: string; name: string | null; image: string | null };

export function ClientsTable({
  data,
  total,
  page,
  perPage,
  pageCount,
  managers,
  allTags,
  canCreate,
  canUpdate,
  canDelete,
  canExport,
}: {
  data: ClientListRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  managers: Manager[];
  allTags: { id: string; name: string; color: string }[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({ createdAt: false, businessCategory: false });
  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  /** Writes filter/sort/page state into the URL so it stays shareable. */
  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any filter change invalidates the current page offset.
      if (!("page" in updates)) next.delete("page");
      startTransition(() => router.push(`/clients?${next.toString()}`));
    },
    [params, router],
  );

  // Debounce the search box so typing doesn't fire a request per keystroke.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => setParam({ q: search || null }), 350);
    return () => clearTimeout(timer);
  }, [search, params, setParam]);

  const sort = params.get("sort") ?? "companyName";
  const dir = params.get("dir") ?? "asc";

  const toggleSort = (column: string) => {
    setParam({
      sort: column,
      dir: sort === column && dir === "asc" ? "desc" : "asc",
    });
  };

  const columns = React.useMemo<ColumnDef<ClientListRow>[]>(() => {
    const base: ColumnDef<ClientListRow>[] = [];

    if (canUpdate || canDelete) {
      base.push({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label={`Select ${row.original.companyName}`}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableHiding: false,
      });
    }

    base.push(
      {
        accessorKey: "companyName",
        header: "Client",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/clients/${row.original.id}`}
              className="block truncate font-medium hover:text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.companyName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {[row.original.city, row.original.state].filter(Boolean).join(", ") ||
                row.original.email ||
                "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "businessCategory",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.businessCategory ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE_VARIANT[row.original.status]}>
            {CLIENT_STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <Badge variant={PRIORITY_BADGE_VARIANT[row.original.priority]}>
            {PRIORITY_LABELS[row.original.priority]}
          </Badge>
        ),
      },
      {
        id: "services",
        header: "Services",
        cell: ({ row }) => {
          const services = row.original.services;
          if (services.length === 0)
            return <span className="text-sm text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {services.slice(0, 2).map((s) => (
                <Badge key={s} variant="outline" className="font-normal">
                  {SERVICE_LABELS[s]}
                </Badge>
              ))}
              {services.length > 2 && (
                <Badge variant="muted">+{services.length - 2}</Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "monthlyRetainer",
        header: "Retainer",
        cell: ({ row }) => (
          <span className="tabular text-sm font-medium">
            {row.original.monthlyRetainer
              ? `${formatCurrency(row.original.monthlyRetainer)}/mo`
              : "—"}
          </span>
        ),
      },
      {
        id: "accountManager",
        header: "Manager",
        cell: ({ row }) => {
          const manager = row.original.accountManager;
          if (!manager)
            return <span className="text-sm text-muted-foreground">Unassigned</span>;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="size-6">
                {manager.image && <AvatarImage src={manager.image} alt="" />}
                <AvatarFallback className="text-[9px]">
                  {initials(manager.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{manager.name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "renewalDate",
        header: "Renewal",
        cell: ({ row }) => (
          <span className="tabular text-sm">
            {row.original.renewalDate
              ? format(row.original.renewalDate, "MMM d, yyyy")
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Added",
        cell: ({ row }) => (
          <span className="tabular text-sm text-muted-foreground">
            {format(row.original.createdAt, "MMM d, yyyy")}
          </span>
        ),
      },
    );

    if (canUpdate || canDelete) {
      base.push({
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.original.companyName}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/clients/${row.original.id}`}>View details</Link>
              </DropdownMenuItem>
              {canUpdate && (
                <DropdownMenuItem onClick={() => setEditingId(row.original.id)}>
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
                          `Archive ${row.original.companyName}? It will be hidden from lists but kept for reporting.`,
                        )
                      )
                        return;
                      startTransition(async () => {
                        const result = await deleteClient(row.original.id);
                        if (result.ok) {
                          toast.success(`${row.original.companyName} archived`);
                          router.refresh();
                        } else {
                          toast.error(result.error);
                        }
                      });
                    }}
                  >
                    <Trash2 />
                    Archive
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    }

    return base;
  }, [canUpdate, canDelete, router]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Sorting/filtering/pagination all happen server-side via URL params.
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount,
    state: { rowSelection, columnVisibility },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => row.id,
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const hasFilters = ["q", "status", "priority", "accountManagerId"].some((k) =>
    params.get(k),
  );

  function exportCsv() {
    const rows = (selectedIds.length > 0
      ? data.filter((r) => selectedIds.includes(r.id))
      : data
    ).map((r) => ({
      Company: r.companyName,
      Owner: r.ownerName ?? "",
      Email: r.email ?? "",
      Phone: r.phone ?? "",
      Website: r.website ?? "",
      City: r.city ?? "",
      State: r.state ?? "",
      Category: r.businessCategory ?? "",
      Status: CLIENT_STATUS_LABELS[r.status],
      Priority: PRIORITY_LABELS[r.priority],
      Services: r.services.map((s) => SERVICE_LABELS[s]).join("; "),
      Retainer: r.monthlyRetainer ?? "",
      Manager: r.accountManager?.name ?? "",
      Renewal: r.renewalDate ? format(r.renewalDate, "yyyy-MM-dd") : "",
    }));

    if (rows.length === 0) {
      toast.error("Nothing to export.");
      return;
    }

    const csv = toCsv(rows, Object.keys(rows[0]!));
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} client${rows.length === 1 ? "" : "s"}`);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="pl-9"
              aria-label="Search clients"
            />
          </div>

          <Select
            value={params.get("status") ?? "all"}
            onValueChange={(v) => setParam({ status: v === "all" ? null : v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.values(ClientStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {CLIENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={params.get("priority") ?? "all"}
            onValueChange={(v) => setParam({ priority: v === "all" ? null : v })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {Object.values(Priority).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setParam({
                  q: null,
                  status: null,
                  priority: null,
                  accountManagerId: null,
                })
              }
            >
              <X />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Toggle columns">
                <SlidersHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                    className="capitalize"
                  >
                    {column.id.replace(/([A-Z])/g, " $1").toLowerCase()}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {canExport && (
            <Button variant="outline" onClick={exportCsv}>
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}

          {canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              <span className="hidden sm:inline">New client</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <Card className="mb-3 flex flex-wrap items-center gap-3 bg-primary/5 p-3">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {canUpdate && (
              <Select
                onValueChange={(status) =>
                  startTransition(async () => {
                    const result = await bulkUpdateStatus(
                      selectedIds,
                      status as ClientStatus,
                    );
                    if (result.ok) {
                      toast.success(`Updated ${selectedIds.length} client(s)`);
                      setRowSelection({});
                      router.refresh();
                    } else {
                      toast.error(result.error);
                    }
                  })
                }
              >
                <SelectTrigger className="h-8 w-40 bg-card text-xs">
                  <SelectValue placeholder="Set status…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ClientStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {CLIENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!confirm(`Archive ${selectedIds.length} client(s)?`)) return;
                  startTransition(async () => {
                    const result = await bulkDeleteClients(selectedIds);
                    if (result.ok) {
                      toast.success(`Archived ${selectedIds.length} client(s)`);
                      setRowSelection({});
                      router.refresh();
                    } else {
                      toast.error(result.error);
                    }
                  });
                }}
              >
                <Trash2 />
                Archive
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRowSelection({})}
            >
              Clear selection
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className={cn("overflow-hidden", pending && "opacity-60")}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sortable = [
                    "companyName",
                    "status",
                    "monthlyRetainer",
                    "renewalDate",
                    "createdAt",
                  ].includes(header.column.id);
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(header.column.id)}
                          className="inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <ArrowUpDown
                            className={cn(
                              "size-3",
                              sort === header.column.id
                                ? "text-accent"
                                : "opacity-40",
                            )}
                          />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center text-sm text-muted-foreground"
                >
                  {hasFilters
                    ? "No clients match those filters."
                    : "No clients yet. Add your first one to get started."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => router.push(`/clients/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "No clients"
            : `Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}`}
        </p>

        <div className="flex items-center gap-2">
          <Select
            value={String(perPage)}
            onValueChange={(v) => setParam({ perPage: v, page: "1" })}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span className="tabular px-1 text-sm">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= pageCount}
            onClick={() => setParam({ page: String(page + 1) })}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Create / edit */}
      {canCreate && (
        <ClientFormSheet
          open={creating}
          onOpenChange={setCreating}
          managers={managers}
          allTags={allTags}
        />
      )}
      {canUpdate && editingId && (
        <ClientFormSheet
          open={!!editingId}
          onOpenChange={(open) => !open && setEditingId(null)}
          managers={managers}
          allTags={allTags}
          clientId={editingId}
        />
      )}
    </>
  );
}
