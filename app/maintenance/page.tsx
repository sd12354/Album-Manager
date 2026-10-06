import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { VinylLogo } from "@/components/vinyl-logo";
import { MaintenanceRetry } from "@/components/maintenance-retry";
import { isMaintenanceMode } from "@/lib/backend-health";

// Read the maintenance switch and message on every request, never at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VinylVault — Back shortly",
  robots: { index: false, follow: false },
};

/**
 * The downtime page. The request proxy serves this in place of any page when
 * MAINTENANCE_MODE is on (planned work) or when the backend cannot be reached
 * (unplanned outage); see lib/supabase/middleware.ts.
 */
export default function MaintenancePage() {
  const planned = isMaintenanceMode(process.env);
  const note = (process.env.MAINTENANCE_MESSAGE ?? "").trim();
  const supportEmail = (process.env.SUPPORT_EMAIL ?? "").trim();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 py-12 text-center animate-fade-in">
      <VinylLogo size="lg" />

      <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-card">
        <Wrench className="h-7 w-7 text-accent" aria-hidden="true" />
      </div>

      <h1 className="mt-6 max-w-xl font-display text-3xl font-bold tracking-tight">
        {planned
          ? "We’re doing some work on VinylVault"
          : "VinylVault is temporarily unavailable"}
      </h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {planned
          ? "The site is offline for a short while so we can make improvements."
          : "We can’t reach our servers right now and are working on it."}{" "}
        Your records, prices and photos are safe, and nothing you’ve saved
        will be lost.
      </p>

      {planned && note && (
        <p className="mt-4 max-w-md rounded-lg border border-white/10 bg-card px-4 py-3 text-sm text-foreground">
          {note}
        </p>
      )}

      <MaintenanceRetry />

      {supportEmail && (
        <p className="mt-8 text-xs text-muted-foreground">
          Need something in the meantime?{" "}
          <a
            href={`mailto:${supportEmail}`}
            className="text-accent underline-offset-4 hover:underline"
          >
            {supportEmail}
          </a>
        </p>
      )}
    </div>
  );
}
