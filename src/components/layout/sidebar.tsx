"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavGroup } from "@/lib/navigation";
import { canAccessResource } from "@/lib/rbac";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_WIDTH = 264;
const SIDEBAR_WIDTH_COLLAPSED = 76;

export function Sidebar({
  role,
  collapsed,
  onToggle,
  /** Rendered inside the mobile sheet, where collapsing does not apply. */
  variant = "desktop",
  onNavigate,
}: {
  role: UserRole;
  collapsed: boolean;
  onToggle: () => void;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isMobile = variant === "mobile";
  const isCollapsed = !isMobile && collapsed;

  // Hide entire groups the role cannot reach, so a Content Writer never sees
  // an empty "Finance" heading.
  const groups = React.useMemo<NavGroup[]>(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          canAccessResource(role, item.resource),
        ),
      })).filter((group) => group.items.length > 0),
    [role],
  );

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isMobile
          ? "100%"
          : isCollapsed
            ? SIDEBAR_WIDTH_COLLAPSED
            : SIDEBAR_WIDTH,
      }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground",
        !isMobile && "border-r border-sidebar-border",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          isCollapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent"
        >
          {isCollapsed ? (
            <BrandLogo variant="mark" className="h-8" />
          ) : (
            <BrandLogo forceTone="dark" className="h-9" priority />
          )}
        </Link>

        {!isCollapsed && !isMobile && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="rounded-sm p-1.5 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {isCollapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand sidebar"
          className="mx-auto mt-3 rounded-sm p-1.5 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {/* Nav */}
      <nav
        className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4"
        aria-label="Main navigation"
      >
        {groups.map((group) => (
          <div key={group.label}>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent",
                      active
                        ? "bg-white/10 text-sidebar-foreground"
                        : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
                      isCollapsed && "justify-center px-0",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-sidebar-accent"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        active && "text-sidebar-accent",
                      )}
                    />
                    {!isCollapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.soon && (
                          <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sidebar-muted">
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">
                          {item.label}
                          {item.soon && " · coming soon"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!isCollapsed && (
        <div className="shrink-0 border-t border-sidebar-border p-4">
          <p className="text-[10px] leading-relaxed text-sidebar-muted">
            Local Rankers LLC · Hicksville, NY
          </p>
        </div>
      )}
    </motion.aside>
  );
}
