"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/version";
import { CHANGELOG } from "@/lib/changelog";

const SEEN_VERSION_KEY = "vinylvault.lastSeenVersion";
const ONBOARDED_KEY = "vinylvault.onboarded";

/**
 * One-shot per release notice. Shown to *returning* users (anyone who has
 * completed onboarding at least once) when the app has shipped a new
 * version since they last opened it. New users only see the full
 * onboarding walkthrough — never both at once.
 *
 * Mechanism:
 *  - On mount, read `vinylvault.lastSeenVersion` from localStorage.
 *  - If the user has NOT completed onboarding (ONBOARDED_KEY missing),
 *    do nothing — the onboarding modal handles them, and we treat them
 *    as having seen the current version when they close that flow.
 *  - If they have completed onboarding AND lastSeenVersion is missing
 *    or different from APP_VERSION, show this modal. On close, write
 *    APP_VERSION so it doesn't show again until the next release.
 */
export function UpdateModal() {
  const [open, setOpen] = useState(false);
  const latest = CHANGELOG[0];

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const onboarded = window.localStorage.getItem(ONBOARDED_KEY) === "1";
      if (!onboarded) {
        // Brand-new user — the onboarding modal will handle them. Don't
        // pile a second modal on top; we'll silently mark this version as
        // seen so the update modal doesn't fire the next time they open
        // the app either.
        window.localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
        return;
      }

      const seen = window.localStorage.getItem(SEEN_VERSION_KEY);
      if (seen !== APP_VERSION) setOpen(true);
    } catch {
      // Private-mode Safari etc. — never let a storage failure ship a
      // broken modal flow.
    }
  }, []);

  function close() {
    try {
      window.localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open || !latest) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-fade-in-up"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          title="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Accent header */}
        <div className="border-b border-border bg-accent/5 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-accent">
                What&apos;s new
              </p>
              <h2
                id="update-modal-title"
                className="mt-0.5 truncate font-display text-lg font-bold text-foreground"
              >
                {latest.title}
              </h2>
            </div>
            <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              v{latest.version ?? APP_VERSION}
            </span>
          </div>
        </div>

        {/* Bullet list */}
        <div className="px-6 py-5">
          <ul className="space-y-2.5">
            {latest.items.slice(0, 6).map((item, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-6 py-4">
          <p className="text-[11px] text-muted-foreground">
            Released {latest.date}
          </p>
          <Button onClick={close} className="gap-1.5">
            Got it
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
