"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronRight, LogOut, Menu, Settings, User as UserIcon } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { cn, initials, stringToHue } from "@/lib/utils";
import { SEGMENT_LABELS } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CommandPalette } from "@/components/layout/command-palette";

export function Topbar({
  user,
  unreadCount,
}: {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: UserRole;
  };
  unreadCount: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // "/clients/abc" → [{ label: "Clients", href: "/clients" }, { label: "abc" }]
  const crumbs = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((segment, i) => ({
      label:
        SEGMENT_LABELS[segment] ??
        segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      href: `/${segments.slice(0, i + 1).join("/")}`,
      isLast: i === segments.length - 1,
    }));
  }, [pathname]);

  const hue = stringToHue(user.id);

  return (
    <header className="glass sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
      {/* Mobile nav */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            role={user.role}
            collapsed={false}
            onToggle={() => {}}
            variant="mobile"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb) => (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {crumb.isLast ? (
                <span className="truncate font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <>
                  <Link
                    href={crumb.href}
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex items-center gap-1">
        <CommandPalette />
        <NotificationBell initialCount={unreadCount} />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Account menu"
            >
              <Avatar>
                {user.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback
                  style={{
                    backgroundColor: `oklch(0.88 0.06 ${hue})`,
                    color: `oklch(0.32 0.09 ${hue})`,
                  }}
                >
                  {initials(user.name ?? user.email)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="normal-case">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.name ?? "Unnamed user"}
              </p>
              <p className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </p>
              <span
                className={cn(
                  "mt-2 inline-block rounded-sm bg-primary/15 px-1.5 py-0.5",
                  "text-[10px] font-semibold uppercase tracking-wide text-foreground",
                )}
              >
                {ROLE_LABELS[user.role]}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <UserIcon />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
