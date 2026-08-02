"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EmployeePicker({
  employees,
  value,
}: {
  employees: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const q = new URLSearchParams(params.toString());
        q.set("employee", next);
        router.push(`${pathname}?${q.toString()}`);
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select employee" />
      </SelectTrigger>
      <SelectContent>
        {employees.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
