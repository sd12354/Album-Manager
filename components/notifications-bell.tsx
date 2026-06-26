"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Disc3,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { AppNotification } from "@/types";

const LAST_READ_KEY = "vinylvault.notifications.lastReadAt";

function getLastReadAt(): string | null {
  try {
    return window.localStorage.getItem(LAST_READ_KEY);
  } catch {
    return null;
  }
}

function setLastReadAt(iso: string) {
  try {
    window.localStorage.setItem(LAST_READ_KEY, iso);
  } catch {
    // ignore
  }
}

function countUnread(notifications: AppNotification[]): number {
  const lastRead = getLastReadAt();
  if (!lastRead) return notifications.length;
  const cutoff = new Date(lastRead).getTime();
  return notifications.filter(
    (n) => new Date(n.createdAt).getTime() > cutoff
  ).length;
}

function iconFor(type: AppNotification["type"]) {
  switch (type) {
    case "album_sold":
      return Disc3;
    case "collection_invite":
      return UserPlus;
    case "collection_shared":
    case "collaborator_joined":
      return Users;
    default:
      return Bell;
  }
}

/**
 * Per-notification-type accent so the inbox reads at a glance — sales
 * pop green (money in), invites pop accent purple (welcome moment),
 * collaboration events pop blue (shared world). Defaults stay muted.
 */
function colorFor(type: AppNotification["type"]): string {
  switch (type) {
    case "album_sold":
      return "bg-emerald-500/15 text-emerald-400";
    case "collection_invite":
      return "bg-accent/15 text-accent";
    case "collection_shared":
    case "collaborator_joined":
      return "bg-blue-500/15 text-blue-400";
    default:
      return "bg-muted/50 text-muted-foreground";
  }
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: AppNotification[] };
      const list = data.notifications ?? [];
      setNotifications(list);
      setUnreadCount(countUnread(list));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;

    setLastReadAt(new Date().toISOString());
    setUnreadCount(0);

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) void refresh();
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        title="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted/40 hover:text-accent ${
          unreadCount > 0 ? "text-accent" : "text-muted-foreground"
        }`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-border bg-card shadow-lg animate-fade-in"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              Recent sales and collaboration activity
            </p>
          </div>

          <div className="max-h-[min(60vh,20rem)] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No new notifications
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Sales and invites from the last 30 days will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((item) => {
                  const Icon = iconFor(item.type);
                  const color = colorFor(item.type);
                  const inner = (
                    <>
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {item.message}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </span>
                    </>
                  );

                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex gap-3 px-4 py-3">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
