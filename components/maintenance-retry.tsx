"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHECK_EVERY_MS = 20_000;

async function siteIsBack(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean; maintenance?: boolean };
    return data.ok === true && data.maintenance !== true;
  } catch {
    return false;
  }
}

/**
 * The proxy shows the downtime page at whatever address was requested, so a
 * plain reload returns people to where they were going. Only the literal
 * /maintenance address needs sending somewhere else.
 */
function leaveDowntimePage() {
  if (window.location.pathname === "/maintenance") {
    window.location.replace("/");
  } else {
    window.location.reload();
  }
}

/**
 * "Try again" button plus a quiet background check, so the page clears by
 * itself once the site is back without anyone having to keep refreshing.
 */
export function MaintenanceRetry() {
  const [checking, setChecking] = useState(false);
  const [stillDown, setStillDown] = useState(false);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (await siteIsBack()) leaveDowntimePage();
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  async function handleRetry() {
    setChecking(true);
    setStillDown(false);
    if (await siteIsBack()) {
      leaveDowntimePage();
      return;
    }
    setStillDown(true);
    setChecking(false);
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <Button onClick={handleRetry} disabled={checking} size="lg">
        <RefreshCw className={checking ? "animate-spin" : undefined} />
        {checking ? "Checking…" : "Try again"}
      </Button>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {stillDown
          ? "Not back yet. This page will refresh by itself when we are."
          : "This page will refresh by itself when we’re back."}
      </p>
    </div>
  );
}
