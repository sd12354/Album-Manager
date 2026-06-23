"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlbumOption {
  id: string;
  artist: string;
  title: string;
  /** Optional confidence label appended to the row (e.g. "82%"). */
  hint?: string;
}

interface SearchableAlbumPickerProps {
  /** Catalogue rows that can be picked. */
  options: AlbumOption[];
  /** Subset of options to surface at the top as suggested matches. */
  suggested?: AlbumOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableAlbumPicker({
  options,
  suggested = [],
  value,
  onChange,
  placeholder = "Pick album…",
  className,
}: SearchableAlbumPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  // Focus the search input each time we open.
  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        o.artist.toLowerCase().includes(q) || o.title.toLowerCase().includes(q)
    );
  }, [options, query]);

  // When searching, show flat results. Otherwise show suggested first, then the rest.
  const groups: Array<{ label: string | null; items: AlbumOption[] }> = useMemo(() => {
    if (filtered) return [{ label: null, items: filtered.slice(0, 100) }];
    const suggestedIds = new Set(suggested.map((s) => s.id));
    const rest = options.filter((o) => !suggestedIds.has(o.id));
    const g: Array<{ label: string | null; items: AlbumOption[] }> = [];
    if (suggested.length > 0) g.push({ label: "Suggested matches", items: suggested });
    if (rest.length > 0) g.push({ label: suggested.length > 0 ? "All albums" : null, items: rest.slice(0, 200) });
    return g;
  }, [filtered, options, suggested]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-left text-xs transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? (
            <>
              <span className="font-medium">{selected.artist}</span>
              <span className="text-muted-foreground"> — {selected.title}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-[60] mt-1 max-h-80 overflow-hidden rounded-lg border border-border bg-background shadow-2xl animate-fade-in">
          <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artist or title…"
              className="h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {groups.length === 0 || groups.every((g) => g.items.length === 0) ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {query ? "No matches." : "No albums yet."}
              </p>
            ) : (
              groups.map((g, gi) => (
                <div key={gi}>
                  {g.label && (
                    <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {g.label}
                    </p>
                  )}
                  {g.items.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        onChange(o.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/50",
                        o.id === value && "bg-muted/40"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{o.artist}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {o.title}
                          {o.hint && (
                            <span className="ml-1 text-accent">{o.hint}</span>
                          )}
                        </span>
                      </span>
                      {o.id === value && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
            {filtered && options.length > filtered.length + 100 && (
              <p className="px-3 py-2 text-center text-[10px] text-muted-foreground">
                Showing first 100 — refine your search to narrow further.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
