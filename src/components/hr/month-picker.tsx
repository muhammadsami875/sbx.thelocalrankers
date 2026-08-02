"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format, subMonths } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Month selector that writes `?month=yyyy-MM` so the choice is shareable. */
export function MonthPicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Last 18 months, newest first.
  const options = Array.from({ length: 18 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { key: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const q = new URLSearchParams(params.toString());
        q.set("month", next);
        router.push(`${pathname}?${q.toString()}`);
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
