"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PORTAL_NAV } from "@/lib/navigation";

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Portal navigation"
      className="mx-auto w-full max-w-7xl overflow-x-auto px-4 scrollbar-thin sm:px-6"
    >
      <ul className="flex items-center gap-1">
        {PORTAL_NAV.map((item) => {
          const active =
            item.href === "/portal"
              ? pathname === "/portal"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
                {active && (
                  <motion.span
                    layoutId="portal-nav-active"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
