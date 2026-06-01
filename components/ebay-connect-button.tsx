"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface EbayConnectButtonProps {
  connected: boolean;
  username?: string;
  onStatusChange?: (connected: boolean) => void;
}

export function EbayConnectButton({
  connected,
  username,
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
