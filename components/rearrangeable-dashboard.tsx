"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, RotateCcw } from "lucide-react";

const ORDER_KEY = "vinylvault.dashboard.order";

export interface DashboardSection {
  /** Stable identifier persisted to localStorage. Don't rename casually. */
  id: string;
  /** Used for the drag-handle title + screen-reader label. */
  label: string;
  node: React.ReactNode;
}

interface Props {
  sections: DashboardSection[];
}

/**
 * Lets the user drag-reorder the dashboard sections and remembers their
 * preference per-device in localStorage. New sections added in a future
 * release append to the end so the user's existing preference still holds.
 * Sections removed in code are dropped from the persisted order on the
 * next load. The drag handle is desktop-only — touch reorder isn't
 * supported yet so the order is fixed on mobile.
 */
export function RearrangeableDashboard({ sections }: Props) {
  const defaultOrder = useMemo(() => sections.map((s) => s.id), [sections]);
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [hydrated, setHydrated] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Keep refs to each section wrapper so we can use the row itself as the
  // drag preview — without this, the browser shows just the tiny handle.
  const refs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ORDER_KEY);
      if (raw) {
        const stored: unknown = JSON.parse(raw);
        if (Array.isArray(stored)) {
          const validIds = new Set(defaultOrder);
          const filtered = stored.filter(
            (id): id is string => typeof id === "string" && validIds.has(id)
          );
          const missing = defaultOrder.filter((id) => !filtered.includes(id));
          setOrder([...filtered, ...missing]);
        }
      }
    } catch {
      // Corrupted JSON or storage disabled — fall back to default order.
    }
    setHydrated(true);
  }, [defaultOrder]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      // ignore
    }
  }, [order, hydrated]);

  function onDragStart(id: string) {
    return (e: React.DragEvent<HTMLButtonElement>) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      const row = refs.current.get(id);
      if (row) {
        // Anchor the ghost near the handle so the cursor stays attached
        // to where the user grabbed.
        e.dataTransfer.setDragImage(row, 24, 24);
      }
    };
  }

  function onDragOver(id: string) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (id !== hoverId) setHoverId(id);
    };
  }

  function onDrop(targetId: string) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain") || dragId;
      setDragId(null);
      setHoverId(null);
      if (!sourceId || sourceId === targetId) return;
      setOrder((prev) => {
        const next = prev.filter((id) => id !== sourceId);
        const targetIndex = next.indexOf(targetId);
        next.splice(targetIndex < 0 ? next.length : targetIndex, 0, sourceId);
        return next;
      });
    };
  }

  function onDragEnd() {
    setDragId(null);
    setHoverId(null);
  }

  function reset() {
    setOrder(defaultOrder);
  }

  const customized =
    hydrated && order.some((id, i) => defaultOrder[i] !== id);
  const byId = new Map(sections.map((s) => [s.id, s]));

  return (
    <>
      {customized && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-accent"
          >
            <RotateCcw className="h-3 w-3" />
            Reset layout
          </button>
        </div>
      )}
      {order.map((id) => {
        const section = byId.get(id);
        if (!section) return null;
        const isDragging = dragId === id;
        const isDropTarget = hoverId === id && dragId && dragId !== id;
        return (
          <div
            key={id}
            ref={(el) => {
              refs.current.set(id, el);
            }}
            onDragOver={onDragOver(id)}
            onDrop={onDrop(id)}
            className={`group/dashsection relative mt-8 rounded-xl transition-all ${
              isDragging ? "opacity-40" : ""
            } ${
              isDropTarget
                ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-background"
                : ""
            }`}
          >
            <button
              type="button"
              draggable
              onDragStart={onDragStart(id)}
              onDragEnd={onDragEnd}
              aria-label={`Drag to reorder ${section.label}`}
              title={`Drag to reorder ${section.label}`}
              className="absolute -left-7 top-4 hidden h-7 w-6 cursor-grab items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all hover:bg-muted/40 hover:text-accent active:cursor-grabbing group-hover/dashsection:opacity-100 md:flex"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            {section.node}
          </div>
        );
      })}
    </>
  );
}
