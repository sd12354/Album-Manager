"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface EbayConnectButtonProps {
  connected: boolean;
  username?: string;
  environment?: "production" | "sandbox" | "stub" | string;
  onStatusChange?: (connected: boolean) => void;
}

export function EbayConnectButton({
  connected,
  username,
  environment,
  onStatusChange,
}: EbayConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleConnect() {
    setLoading(true);
    window.location.href = "/api/ebay/connect";
  }

  async function handleDisconnect() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("ebay_credentials").delete().eq("user_id", user.id);
      onStatusChange?.(false);
    }
    setLoading(false);
  }

  if (connected) {
    const envBadgeClass =
      environment === "production"
        ? "bg-emerald-500/15 text-emerald-400"
        : environment === "sandbox"
          ? "bg-amber-500/15 text-amber-400"
          : "bg-white/8 text-muted-foreground";
    const envLabel =
      environment === "production"
        ? "Production"
        : environment === "sandbox"
          ? "Sandbox"
          : environment === "stub"
            ? "Stub"
            : null;

    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm">
            Connected as{" "}
            <span className="font-medium text-accent">
              {username ?? "vinyl_collector_pro"}
            </span>
          </span>
          {envLabel && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${envBadgeClass}`}
            >
              {envLabel}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={loading}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect} disabled={loading}>
      Connect eBay Account
    </Button>
  );
}
