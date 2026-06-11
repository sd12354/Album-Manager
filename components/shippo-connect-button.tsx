"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { createClient } from "@/lib/supabase/client";

interface ShippoConnectButtonProps {
  connected: boolean;
  accountLabel?: string;
  oauthConfigured: boolean;
  onStatusChange?: (connected: boolean) => void;
}

export function ShippoConnectButton({
  connected,
  accountLabel,
  oauthConfigured,
  onStatusChange,
}: ShippoConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  function handleConnect() {
    if (!oauthConfigured) {
      toast.error(
        "Shippo OAuth isn't configured on the server. Use an API key below instead.",
        { duration: 8000 }
      );
      return;
    }
    setLoading(true);
    window.location.href = "/api/shippo/connect";
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/shippo/disconnect", { method: "POST" });
      if (!res.ok) {
        toast.error("Could not disconnect Shippo");
        return;
      }
      await supabase.auth.refreshSession();
      onStatusChange?.(false);
      toast.success("Disconnected from Shippo");
    } catch {
      toast.error("Network error while disconnecting");
    } finally {
      setLoading(false);
    }
  }

  if (connected) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm">
            Connected as{" "}
            <span className="font-medium text-accent">
              {accountLabel ?? "Shippo account"}
            </span>
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
            OAuth
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={loading}
        >
          {loading ? <VinylSpinner size="xs" /> : "Disconnect"}
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect} disabled={loading}>
      {loading ? (
        <>
          <VinylSpinner size="xs" />
          Redirecting…
        </>
      ) : (
        "Connect Shippo Account"
      )}
    </Button>
  );
}
