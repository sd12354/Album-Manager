"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { createClient } from "@/lib/supabase/client";

interface DiscogsConnectButtonProps {
  connected: boolean;
  username?: string;
  oauthConfigured: boolean;
  onStatusChange?: (connected: boolean) => void;
}

export function DiscogsConnectButton({
  connected,
  username,
  oauthConfigured,
  onStatusChange,
}: DiscogsConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  function handleConnect() {
    if (!oauthConfigured) {
      toast.error(
        "Discogs OAuth isn't configured on the server. Use a personal access token below instead.",
        { duration: 8000 }
      );
      return;
    }
    setLoading(true);
    window.location.href = "/api/discogs/connect";
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/discogs/disconnect", { method: "POST" });
      if (!res.ok) {
        toast.error("Could not disconnect Discogs");
        return;
      }
      // Refresh the locally cached user so metadata reflects the change.
      await supabase.auth.refreshSession();
      onStatusChange?.(false);
      toast.success("Disconnected from Discogs");
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
              {username ?? "Discogs user"}
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
        "Connect Discogs Account"
      )}
    </Button>
  );
}
