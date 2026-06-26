"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Disc2,
  DollarSign,
  Download,
  ImageOff,
  Library,
  LayoutDashboard,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Tag,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Album = {
  id: string;
  title: string;
  artist: string;
  status?: string;
  list_price?: number | null;
  suggested_price?: number | null;
};

interface DashboardSearchProps {
  albums: Album[];
}

interface CommandItem {
  id: string;
  group: "Pages" | "Actions" | "Filters" | "Albums";
  label: string;
  /** Extra context shown muted next to the label (artist for albums, etc.). */
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** Optional searchable keywords beyond label/hint. */
  keywords?: string;
}

const PAGES: CommandItem[] = [
  {
    id: "page-dashboard",
    group: "Pages",
    label: "Dashboard",
    hint: "Stats, sales, collection value",
    icon: LayoutDashboard,
    href: "/dashboard",
    keywords: "home overview stats analytics",
  },
  {
    id: "page-catalogue",
    group: "Pages",
    label: "Catalogue",
    hint: "Browse all your records",
    icon: Library,
    href: "/albums",
    keywords: "albums records collection browse table",
  },
  {
    id: "page-import",
    group: "Pages",
    label: "Import",
    hint: "Bring in CSV, JSON, or photos",
    icon: Upload,
    href: "/import",
    keywords: "csv json upload bulk cover photos",
  },
  {
    id: "page-settings",
    group: "Pages",
    label: "Settings",
    hint: "Connections, account, export",
    icon: SettingsIcon,
    href: "/settings",
    keywords: "config preferences account profile",
  },
];

const ACTIONS: CommandItem[] = [
  {
    id: "action-add-album",
    group: "Actions",
    label: "Add an album",
    hint: "Open the manual add drawer",
    icon: Disc2,
    href: "/albums?add=true",
    keywords: "new record create entry manual",
  },
  {
    id: "action-price-all",
    group: "Actions",
    label: "Auto-price all unlisted",
    hint: "Run rule-based pricing on the gaps",
    icon: DollarSign,
    href: "/albums?action=price-all",
    keywords: "pricing discogs ebay bulk fetch",
  },
  {
    id: "action-ai-pricing",
    group: "Actions",
    label: "AI pricing",
    hint: "Catalogue → select rows → AI-Price",
    icon: Sparkles,
    href: "/albums",
    keywords: "claude ai pricing analysis bulk smart",
  },
  {
    id: "action-export-csv",
    group: "Actions",
    label: "Export collection (CSV)",
    hint: "Download your whole catalogue",
    icon: Download,
    href: "/api/albums/export?format=csv",
    keywords: "backup spreadsheet excel sheets download",
  },
  {
    id: "action-export-json",
    group: "Actions",
    label: "Export collection (JSON)",
    hint: "Download your whole catalogue",
    icon: Download,
    href: "/api/albums/export?format=json",
    keywords: "backup programmatic api download",
  },
  {
    id: "action-invite",
    group: "Actions",
    label: "Invite a collaborator",
    hint: "Settings → Collaborators",
    icon: UserPlus,
    href: "/settings",
    keywords: "share viewer editor add collaborator team",
  },
  {
    id: "action-connect-ebay",
    group: "Actions",
    label: "Connect eBay",
    hint: "Settings → eBay Account",
    icon: Users,
    href: "/settings",
    keywords: "marketplace oauth login authorize ebay",
  },
  {
    id: "action-connect-discogs",
    group: "Actions",
    label: "Connect Discogs",
    hint: "Settings → Discogs Integration",
    icon: Users,
    href: "/settings",
    keywords: "marketplace oauth token discogs",
  },
];

const FILTERS: CommandItem[] = [
  {
    id: "filter-missing-photos",
    group: "Filters",
    label: "Albums missing cover photos",
    hint: "Find what still needs an image",
    icon: ImageOff,
    href: "/albums?photos=missing",
    keywords: "no cover empty without picture image",
  },
  {
    id: "filter-not-priced",
    group: "Filters",
    label: "Albums not priced yet",
    hint: "Find the pricing gaps",
    icon: Tag,
    href: "/albums?pricing=unpriced",
    keywords: "unpriced needs pricing zero blank",
  },
  {
    id: "filter-duplicates",
    group: "Filters",
    label: "Duplicate albums",
    hint: "Spot records you may have imported twice",
    icon: Library,
    href: "/albums?dupes=duplicates",
    keywords: "dupes copies repeated same",
  },
  {
    id: "filter-listed",
    group: "Filters",
    label: "Currently listed albums",
    hint: "What's live on eBay or Discogs right now",
    icon: Tag,
    href: "/albums?status=listed",
    keywords: "marketplace ebay discogs active selling",
  },
  {
    id: "filter-sold",
    group: "Filters",
    label: "Sold albums",
    hint: "Records that have moved",
    icon: Tag,
    href: "/albums?status=sold",
    keywords: "sales history moved revenue",
  },
];

const STATIC_ITEMS: CommandItem[] = [...PAGES, ...ACTIONS, ...FILTERS];

function tokensMatch(haystack: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = haystack.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export function DashboardSearch({ albums }: DashboardSearchProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // Global shortcut: Cmd+K / Ctrl+K focuses the search from anywhere on
  // the dashboard. Standard pattern, zero learning curve for power users.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [focused]);

  // Reset highlight whenever the query changes.
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const results = useMemo<{
    grouped: Array<{ group: string; items: CommandItem[] }>;
    flat: CommandItem[];
  }>(() => {
    const q = query.trim();

    // Empty query: surface a small "jump to" menu so first-time users see
    // the shape without typing.
    if (!q) {
      const items = [...PAGES, ...ACTIONS.slice(0, 3), ...FILTERS.slice(0, 2)];
      return {
        grouped: groupItems(items),
        flat: items,
      };
    }

    // Static matches (pages, actions, filters).
    const staticHits = STATIC_ITEMS.filter((item) =>
      tokensMatch(
        `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`,
        q
      )
    );

    // Album matches: artist or title contains all query tokens.
    const albumHits: CommandItem[] = [];
    for (const album of albums) {
      const haystack = `${album.artist} ${album.title}`;
      if (!tokensMatch(haystack, q)) continue;
      const price = album.list_price ?? album.suggested_price ?? null;
      albumHits.push({
        id: `album-${album.id}`,
        group: "Albums",
        label: album.title,
        hint:
          album.artist +
          (price && price > 0
            ? ` · $${Number(price).toFixed(2)}`
            : ""),
        icon: Disc2,
        href: `/albums/${album.id}`,
      });
      if (albumHits.length >= 12) break;
    }

    const all = [...staticHits, ...albumHits];
    return {
      grouped: groupItems(all),
      flat: all,
    };
  }, [albums, query]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results.flat[highlight];
      if (pick) navigate(pick);
    }
  }

  function navigate(item: CommandItem) {
    setFocused(false);
    // External / API hrefs (e.g. CSV/JSON export) are real GETs; use a
    // hard navigation so the file download fires.
    if (item.href.startsWith("/api/")) {
      window.location.href = item.href;
      return;
    }
    router.push(item.href);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search albums, pages, or actions… (⌘K)"
        className="h-12 pl-9 pr-12 text-sm"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-12 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
        ⌘K
      </span>

      {focused && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[480px] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl animate-fade-in"
        >
          {results.flat.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No matches — try a different word or album title.
            </p>
          ) : (
            <>
              {results.grouped.map((section, sectionIdx) => (
                <div key={section.group}>
                  <p className="border-b border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {section.group}
                  </p>
                  {section.items.map((item) => {
                    const flatIdx = results.flat.indexOf(item);
                    const isActive = flatIdx === highlight;
                    return (
                      <button
                        key={item.id}
                        role="option"
                        aria-selected={isActive}
                        type="button"
                        onMouseEnter={() => setHighlight(flatIdx)}
                        onClick={() => navigate(item)}
                        className={cn(
                          "flex w-full items-center gap-3 border-b border-border/30 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0",
                          isActive
                            ? "bg-accent/10"
                            : "hover:bg-muted/40"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            isActive
                              ? "bg-accent/15 text-accent"
                              : "bg-muted/40 text-muted-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.label}
                          </p>
                          {item.hint && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {item.hint}
                            </p>
                          )}
                        </span>
                      </button>
                    );
                  })}
                  {sectionIdx < results.grouped.length - 1 && (
                    <div className="h-px bg-border/20" />
                  )}
                </div>
              ))}
              <p className="border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
                ↑↓ to navigate · Enter to open · Esc to close
              </p>
            </>
          )}
        </div>
      )}

      {!focused && (
        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="sr-only"
        >
          Open search
        </Link>
      )}
    </div>
  );
}

function groupItems(
  items: CommandItem[]
): Array<{ group: string; items: CommandItem[] }> {
  const map = new Map<string, CommandItem[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  // Stable section order — Pages first, then Actions / Filters, then Albums.
  const order = ["Pages", "Actions", "Filters", "Albums"];
  return order
    .filter((g) => map.has(g))
    .map((g) => ({ group: g, items: map.get(g)! }));
}
