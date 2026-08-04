"use client";

import * as React from "react";
import type { UserRole } from "@prisma/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

const STORAGE_KEY = "lr-crm:sidebar-collapsed";

export function AppShell({
  user,
  unreadCount,
  children,
}: {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: UserRole;
  };
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);

  // Restore the collapse preference after mount so SSR markup stays stable.
  React.useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar role={user.role} collapsed={collapsed} onToggle={toggle} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} unreadCount={unreadCount} />

        <main className="scrollbar-thin flex-1 overflow-y-auto">
          {/* Page transition is a CSS animation, not a JS one.
              Framer's AnimatePresence held this subtree at its `initial`
              opacity:0 when a route streamed in behind a Suspense fallback
              (loading.tsx), leaving the page permanently blank. A CSS
              animation always resolves, so content can never be stranded
              invisible by an animation that failed to start. */}
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
