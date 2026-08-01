import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientsLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="ml-auto h-10 w-32" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-3 py-3">
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-3 py-4 last:border-0"
          >
            <Skeleton className="size-4 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-16 rounded-sm" />
            <Skeleton className="h-5 w-16 rounded-sm" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
    </>
  );
}
