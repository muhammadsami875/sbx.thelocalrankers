"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Notification[] | null>(null);
  const [count, setCount] = React.useState(initialCount);

  // Fetch lazily — the list is only needed once the popover is opened.
  React.useEffect(() => {
    if (!open || items) return;
    let cancelled = false;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((data) => {
        if (!cancelled) setItems(data.notifications ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, items]);

  async function markAllRead() {
    setCount(0);
    setItems((prev) =>
      prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ??
      null,
    );
    await fetch("/api/notifications", { method: "POST" }).catch(() => {});
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        >
          <Bell />
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-accent underline-offset-4 hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {items === null ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const content = (
                  <div className="flex gap-2.5 px-4 py-3 transition-colors hover:bg-muted/60">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: n.readAt
                          ? "transparent"
                          : "var(--color-primary)",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
