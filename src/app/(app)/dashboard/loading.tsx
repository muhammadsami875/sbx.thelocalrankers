import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-8 rounded-md" />
            </div>
            <Skeleton className="mt-4 h-7 w-28" />
            <Skeleton className="mt-3 h-4 w-32" />
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-[280px] w-full" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-[280px] w-full" />
        </Card>
      </div>
    </>
  );
}
