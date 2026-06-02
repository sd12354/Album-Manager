"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EbayConnectButton } from "@/components/ebay-connect-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { createClient } from "@/lib/supabase/client";
import { CONDITION_MULTIPLIERS } from "@/lib/pricing";
import type { AlbumCondition } from "@/types";

interface SettingsClientProps {
  ebayConnected: boolean;
  ebayUsername?: string;
  ebayEnvironment?: "production" | "sandbox" | "stub";
  ebayError?: string;
  discogsEnvTokenConfigured: boolean;
  userSettings: {
    discogs_token?: string;
    minimum_floor_price?: number;
    email_on_sale?: boolean;
    shipping_profile?: string;
    condition_multipliers?: Partial<Record<AlbumCondition, number>>;
    shippo_api_key?: string;
    seller_name?: string;
    seller_street1?: string;
    seller_street2?: string;
    seller_city?: string;
    seller_state?: string;
    seller_zip?: string;
    seller_country?: string;
  };
}

export function SettingsClient({
  ebayConnected: initialConnected,
  ebayUsername,
  ebayEnvironment,
  ebayError,
  discogsEnvTokenConfigured,
  userSettings,
}: SettingsClientProps) {
  const [ebayConnected, setEbayConnected] = useState(initialConnected);
  const [discogsToken, setDiscogsToken] = useState(
    userSettings.discogs_token ?? ""
  );
  const [minFloor, setMinFloor] = useState(
    userSettings.minimum_floor_price?.toString() ?? "3.00"
  );
  const [emailOnSale, setEmailOnSale] = useState(
    userSettings.email_on_sale ?? false
  );
  const [shippingProfile, setShippingProfile] = useState(
    userSettings.shipping_profile ?? "standard"
  );
  const [testingDiscogs, setTestingDiscogs] = useState(false);
  const [testingShippo, setTestingShippo] = useState(false);
  const [saving, setSaving] = useState(false);

  // Shippo + seller address state
  const [shippoKey, setShippoKey] = useState(userSettings.shippo_api_key ?? "");
  const [sellerName, setSellerName] = useState(userSettings.seller_name ?? "");
  const [sellerStreet1, setSellerStreet1] = useState(userSettings.seller_street1 ?? "");
  const [sellerStreet2, setSellerStreet2] = useState(userSettings.seller_street2 ?? "");
  const [sellerCity, setSellerCity] = useState(userSettings.seller_city ?? "");
  const [sellerState, setSellerState] = useState(userSettings.seller_state ?? "");
  const [sellerZip, setSellerZip] = useState(userSettings.seller_zip ?? "");
  const [sellerCountry, setSellerCountry] = useState(userSettings.seller_country ?? "US");

  const supabase = createClient();

  async function saveSettings(updates: Record<string, unknown>) {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.auth.updateUser({
        data: { ...userSettings, ...updates },
      });
      toast.success("Settings saved");
    }
    setSaving(false);
  }

  async function testShippo() {
    setTestingShippo(true);
    try {
      const res = await fetch("/api/integrations/shippo/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: shippoKey }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success("Shippo connected successfully");
      } else {
        toast.error(data.error ?? "Shippo connection failed");
      }
    } catch {
      toast.error("Network error");
    }
    setTestingShippo(false);
  }

  async function testDiscogs() {
    setTestingDiscogs(true);
    try {
      const res = await fetch("/api/integrations/discogs/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: discogsToken }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success("Discogs connection successful");
      } else {
        toast.error(data.error ?? "Discogs connection failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
    setTestingDiscogs(false);
  }

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      {ebayError && (
        <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p className="font-medium">eBay connection failed</p>
          <p className="mt-1 text-red-300/80">{ebayError}</p>
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={["ebay"]}
        className="mt-8 space-y-3"
      >
        <AccordionItem value="ebay" className="animate-fade-in-up stagger-1">
          <AccordionTrigger className="font-display text-lg">
            eBay Account
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <EbayConnectButton
              connected={ebayConnected}
              username={ebayUsername}
              environment={ebayEnvironment}
              onStatusChange={setEbayConnected}
            />

            <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-xs text-muted-foreground">
              <p className="font-medium text-[#F5F4F0]">
                About eBay integration
              </p>
              <p className="mt-1.5 leading-relaxed">
                Connecting your account above grants permission to{" "}
                <strong>list albums</strong> on your behalf.
              </p>
              <p className="mt-1.5 leading-relaxed">
                Separately, eBay pricing comparables (used as a fallback when
                Discogs has no data) come from your app credentials in{" "}
                <code className="text-accent">.env.local</code> — no user OAuth
                required. Sandbox returns very few real listings; switch to
                production credentials for live pricing data.
              </p>
            </div>

            {ebayConnected && (
              <div className="space-y-2">
                <Label>Shipping Profile</Label>
                <Select
                  value={shippingProfile}
                  onValueChange={(v) => {
                    setShippingProfile(v);
                    saveSettings({ shipping_profile: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Shipping</SelectItem>
                    <SelectItem value="express">Express Shipping</SelectItem>
                    <SelectItem value="media">Media Mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="discogs" className="animate-fade-in-up stagger-2">
          <AccordionTrigger className="font-display text-lg">
            <div className="flex items-center gap-2">
              <span>Discogs Integration</span>
              {(discogsToken || discogsEnvTokenConfigured) ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                  Configured
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                  Not configured
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Discogs powers your pricing. Generate a free Personal Access
              Token at{" "}
              <a
                href="https://www.discogs.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                discogs.com/settings/developers
              </a>{" "}
              and paste it below. Per-user tokens override the server default.
            </p>
            <div className="space-y-2">
              <Label htmlFor="discogs_token">Personal Access Token</Label>
              <Input
                id="discogs_token"
                type="password"
                placeholder={
                  discogsEnvTokenConfigured
                    ? "Server default is set — paste to override"
                    : "Enter your Discogs token"
                }
                value={discogsToken}
                onChange={(e) => setDiscogsToken(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={testDiscogs}
                disabled={
                  testingDiscogs ||
                  (!discogsToken && !discogsEnvTokenConfigured)
                }
              >
                {testingDiscogs ? (
                  <>
                    <VinylSpinner size="xs" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button
                onClick={() => saveSettings({ discogs_token: discogsToken })}
                disabled={saving}
              >
                Save Token
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pricing" className="animate-fade-in-up stagger-3">
          <AccordionTrigger className="font-display text-lg">
            Pricing Defaults
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="min_floor">Minimum Floor Price</Label>
              <Input
                id="min_floor"
                type="number"
                step="0.01"
                value={minFloor}
                onChange={(e) => setMinFloor(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Condition Multipliers</Label>
              {(Object.keys(CONDITION_MULTIPLIERS) as AlbumCondition[]).map(
                (condition) => (
                  <div key={condition} className="flex items-center gap-3">
                    <span className="w-16 text-sm">{condition}</span>
                    <Input
                      type="number"
                      step="0.05"
                      defaultValue={CONDITION_MULTIPLIERS[condition]}
                      className="w-24"
                      readOnly
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                  </div>
                )
              )}
            </div>
            <Button
              onClick={() =>
                saveSettings({ minimum_floor_price: parseFloat(minFloor) })
              }
              disabled={saving}
            >
              Save Defaults
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notifications" className="animate-fade-in-up stagger-4">
          <AccordionTrigger className="font-display text-lg">
            Notifications
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email on sale</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when an album sells on eBay
                </p>
              </div>
              <Switch
                checked={emailOnSale}
                onCheckedChange={(checked) => {
                  setEmailOnSale(checked);
                  saveSettings({ email_on_sale: checked });
                }}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="shipping" className="animate-fade-in-up stagger-5">
          <AccordionTrigger className="font-display text-lg">
            <div className="flex items-center gap-2">
              <span>Shipping</span>
              {(shippoKey || process.env.NEXT_PUBLIC_SHIPPO_CONFIGURED) ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                  Configured
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                  Not configured
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              VinylVault uses{" "}
              <a
                href="https://goshippo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Shippo
              </a>{" "}
              to generate prepaid shipping labels automatically when a sale is
              detected. Labels default to USPS Media Mail — the cheapest option
              for vinyl records.
            </p>

            {/* Shippo API key */}
            <div className="space-y-2">
              <Label htmlFor="shippo_key">Shippo API Key</Label>
              <Input
                id="shippo_key"
                type="password"
                placeholder="shippo_test_... or shippo_live_..."
                value={shippoKey}
                onChange={(e) => setShippoKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your key at{" "}
                <a
                  href="https://app.goshippo.com/user/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  app.goshippo.com/user/apikeys
                </a>
                . Use a test key while setting up; switch to live when ready to
                purchase real labels.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={testShippo}
                disabled={testingShippo || !shippoKey}
              >
                {testingShippo ? (
                  <>
                    <VinylSpinner size="xs" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button
                onClick={() => saveSettings({ shippo_api_key: shippoKey })}
                disabled={saving}
              >
                Save Key
              </Button>
            </div>

            {/* Seller / ship-from address */}
            <div className="space-y-3 rounded-xl border border-white/8 p-4">
              <p className="text-sm font-medium">Ship-from address</p>
              <div className="space-y-2">
                <Label>Your Name / Business</Label>
                <Input
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input
                  value={sellerStreet1}
                  onChange={(e) => setSellerStreet1(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-2">
                <Label>Apt / Suite (optional)</Label>
                <Input
                  value={sellerStreet2}
                  onChange={(e) => setSellerStreet2(e.target.value)}
                  placeholder="Apt 2B"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label>City</Label>
                  <Input
                    value={sellerCity}
                    onChange={(e) => setSellerCity(e.target.value)}
                    placeholder="Portland"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={sellerState}
                    onChange={(e) => setSellerState(e.target.value)}
                    placeholder="OR"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>ZIP</Label>
                  <Input
                    value={sellerZip}
                    onChange={(e) => setSellerZip(e.target.value)}
                    placeholder="97201"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={sellerCountry}
                    onChange={(e) => setSellerCountry(e.target.value)}
                    placeholder="US"
                    maxLength={2}
                  />
                </div>
              </div>
              <Button
                onClick={() =>
                  saveSettings({
                    seller_name: sellerName,
                    seller_street1: sellerStreet1,
                    seller_street2: sellerStreet2,
                    seller_city: sellerCity,
                    seller_state: sellerState,
                    seller_zip: sellerZip,
                    seller_country: sellerCountry,
                  })
                }
                disabled={saving}
              >
                Save Address
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
