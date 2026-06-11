"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Library, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AccessibleCollection } from "@/types";

interface CollectionSwitcherProps {
  collections: AccessibleCollection[];
  activeOwnerId: string;
  collapsed?: boolean;
}

export function CollectionSwitcher({
  collections,
  activeOwnerId,
  collapsed = false,
}: CollectionSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const active =
    collections.find((c) => c.ownerId === activeOwnerId) ?? collections[0];

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

  // Don't render a switcher when there's nothing to switch to.
  if (collections.length <= 1) return null;

  async function selectCollection(ownerId: string) {
    if (ownerId === activeOwnerId) {
      setOpen(false);
      return;
    }
    setSwitching(ownerId);
    try {
      const res = await fetch("/api/collection/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Could not switch collection");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error switching collection");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? active?.label : undefined}
        className={cn(
          "flex items-center rounded-lg border border-border bg-background/60 text-sm transition-colors hover:bg-muted/40",
          collapsed
            ? "h-10 w-10 justify-center mx-auto"
            : "w-full gap-2 px-2.5 py-2"
        )}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
          {active?.isOwner ? (
            <Library className="h-3.5 w-3.5" />
          ) : (
            <Users className="h-3.5 w-3.5" />
          )}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-medium text-foreground">
                {active?.label}
              </span>
              <span className="block truncate text-[10px] capitalize text-muted-foreground">
                {active?.isOwner ? "Owner" : active?.role}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl animate-fade-in",
            collapsed ? "left-12 top-0 w-56" : "left-0 right-0"
          )}
        >
          <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Collections
          </p>
          {collections.map((c) => (
            <button
              key={c.ownerId}
              type="button"
              onClick={() => selectCollection(c.ownerId)}
              disabled={!!switching}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                c.ownerId === activeOwnerId && "bg-muted/40"
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
                {c.isOwner ? (
                  <Library className="h-3.5 w-3.5" />
                ) : (
                  <Users className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {c.label}
                </span>
                <span className="block truncate text-[10px] capitalize text-muted-foreground">
                  {c.isOwner ? "Owner" : c.role}
                </span>
              </span>
              {c.ownerId === activeOwnerId && (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
