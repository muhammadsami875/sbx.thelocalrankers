"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FolderKanban,
  Receipt,
  Search,
  ClipboardList,
  CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_GROUPS } from "@/lib/navigation";

type SearchHit = {
  id: string;
  type: "client" | "project" | "invoice" | "task";
  title: string;
  subtitle: string | null;
  href: string;
};

const TYPE_ICON = {
  client: Building2,
  project: FolderKanban,
  invoice: Receipt,
  task: ClipboardList,
} as const;

const TYPE_LABEL = {
  client: "Clients",
  project: "Projects",
  invoice: "Invoices",
  task: "Tasks",
} as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  // ⌘K / Ctrl+K
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced server search.
  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((data) => setHits(data.results ?? []))
        .catch(() => {
          /* aborted or offline — leave previous hits */
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  const grouped = React.useMemo(() => {
    const map = new Map<SearchHit["type"], SearchHit[]>();
    for (const hit of hits) {
      const list = map.get(hit.type) ?? [];
      list.push(hit);
      map.set(hit.type, list);
    }
    return [...map.entries()];
  }, [hits]);

  const navItems = React.useMemo(
    () => NAV_GROUPS.flatMap((g) => g.items),
    [],
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-9 justify-center px-0 text-muted-foreground sm:w-56 sm:justify-start sm:px-3"
        aria-label="Search"
      >
        <Search className="sm:mr-1" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 font-sans text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search clients, projects, invoices, tasks…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {/* cmdk filters client-side by default; results are already
              server-filtered, so shouldFilter stays on only for nav items. */}
          <CommandEmpty>
            {loading
              ? "Searching…"
              : query.trim().length < 2
                ? "Type at least 2 characters to search."
                : "No matches found."}
          </CommandEmpty>

          {grouped.map(([type, items]) => {
            const Icon = TYPE_ICON[type];
            return (
              <CommandGroup key={type} heading={TYPE_LABEL[type]}>
                {items.map((hit) => (
                  <CommandItem
                    key={hit.id}
                    value={`${hit.title} ${hit.subtitle ?? ""} ${hit.id}`}
                    onSelect={() => go(hit.href)}
                  >
                    <Icon className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{hit.title}</p>
                      {hit.subtitle && (
                        <p className="truncate text-xs text-muted-foreground">
                          {hit.subtitle}
                        </p>
                      )}
                    </div>
                    <CornerDownLeft className="size-3 text-muted-foreground/50" />
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          <CommandGroup heading="Go to">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={`goto ${item.label}`}
                  onSelect={() => go(item.href)}
                >
                  <Icon className="text-muted-foreground" />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
