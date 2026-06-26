"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EbayConnectButton } from "@/components/ebay-connect-button";
import { DiscogsConnectButton } from "@/components/discogs-connect-button";
import { CollaboratorsSection } from "@/components/collaborators-section";
import { getAppUrl } from "@/lib/site-url";
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
import { VinylSpinner } from "@/components/vinyl-spinner";
import { createClient } from "@/lib/supabase/client";
import { CONDITION_MULTIPLIERS } from "@/lib/pricing";
import { APP_VERSION } from "@/lib/version";
import { CHANGELOG } from "@/lib/changelog";
import type { AlbumCondition } from "@/types";

interface SettingsClientProps {
  ebayConnected: boolean;
  ebayUsername?: string;
  ebayError?: string;
  discogsEnvTokenConfigured: boolean;
  discogsConnectedViaOAuth: boolean;
  discogsUsername?: string;
  discogsOAuthConfigured: boolean;
  discogsConnectedNotice?: string;
  discogsError?: string;
  userEmail: string;
  userSettings: {
    discogs_token?: string;
    minimum_floor_price?: number;
    shipping_profile?: string;
    condition_multipliers?: Partial<Record<AlbumCondition, number>>;
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
  ebayError,
  discogsEnvTokenConfigured,
  discogsConnectedViaOAuth,
  discogsUsername,
  discogsOAuthConfigured,
  discogsConnectedNotice,
  discogsError,
  userEmail,
  userSettings,
}: SettingsClientProps) {
  const [ebayConnected, setEbayConnected] = useState(initialConnected);
  const [discogsOAuthConnected, setDiscogsOAuthConnected] = useState(
    discogsConnectedViaOAuth
  );
  const [newEmail, setNewEmail] = useState(userEmail);
  const [changingEmail, setChangingEmail] = useState(false);
  const [discogsToken, setDiscogsToken] = useState(
    userSettings.discogs_token ?? ""
  );
  const [minFloor, setMinFloor] = useState(
    userSettings.minimum_floor_price?.toString() ?? "3.00"
  );
  const [shippingProfile, setShippingProfile] = useState(
    userSettings.shipping_profile ?? "standard"
  );
  const [testingDiscogs, setTestingDiscogs] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seller address state
  const [sellerName, setSellerName] = useState(userSettings.seller_name ?? "");
  const [sellerStreet1, setSellerStreet1] = useState(userSettings.seller_street1 ?? "");
  const [sellerStreet2, setSellerStreet2] = useState(userSettings.seller_street2 ?? "");
  const [sellerCity, setSellerCity] = useState(userSettings.seller_city ?? "");
  const [sellerState, setSellerState] = useState(userSettings.seller_state ?? "");
  const [sellerZip, setSellerZip] = useState(userSettings.seller_zip ?? "");
  const [sellerCountry, setSellerCountry] = useState(userSettings.seller_country ?? "US");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (discogsConnectedNotice === "connected") {
      toast.success("Discogs account connected");
    }
    if (discogsError) {
      toast.error(discogsError, { duration: 8000 });
    }
    if (ebayError) {
      toast.error(ebayError, { duration: 8000 });
    }
    // Clean the query string so the toast doesn't re-fire on refresh.
    if (
      typeof window !== "undefined" &&
      (discogsConnectedNotice || discogsError || ebayError)
    ) {
      const url = new URL(window.location.href);
      url.searchParams.delete("discogs");
      url.searchParams.delete("discogs_error");
      url.searchParams.delete("ebay_error");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings(updates: Record<string, unknown>) {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be signed in to save settings.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        data: { ...(user.user_metadata ?? {}), ...updates },
      });

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  }

  function savePricingDefaults() {
    const floorPrice = Number.parseFloat(minFloor);
    if (!Number.isFinite(floorPrice) || floorPrice < 0) {
      toast.error("Minimum floor price must be a valid non-negative number.");
      return;
    }

    void saveSettings({ minimum_floor_price: floorPrice });
  }

  async function changeEmail() {
    const trimmed = newEmail.trim();
    if (!trimmed || trimmed === userEmail) {
      toast.error("Enter a new email address different from your current one.");
      return;
    }
    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: trimmed },
      {
        emailRedirectTo: `${getAppUrl()}/settings`,
      }
    );
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        "Confirmation sent. Check both your old and new inboxes to finish the change.",
        { duration: 10000 }
      );
    }
    setChangingEmail(false);
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
        defaultValue={["account"]}
        className="mt-8 space-y-3"
      >
        <AccordionItem value="account" className="animate-fade-in-up stagger-1">
          <AccordionTrigger className="font-display text-lg">
            Account
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account_email">Email Address</Label>
              <Input
                id="account_email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Changing your email sends a confirmation link to both your
                current and new addresses. The change takes effect once
                confirmed.
              </p>
            </div>
            <Button
              onClick={changeEmail}
              disabled={changingEmail || newEmail.trim() === userEmail}
            >
              {changingEmail ? (
                <>
                  <VinylSpinner size="xs" />
                  Sending confirmation...
                </>
              ) : (
                "Update Email"
              )}
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="collaborators" className="animate-fade-in-up stagger-1">
          <AccordionTrigger className="font-display text-lg">
            Collaborators
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <CollaboratorsSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ebay" className="animate-fade-in-up stagger-1">
          <AccordionTrigger className="font-display text-lg">
            <div className="flex items-center gap-2">
              <span>eBay Account</span>
              {ebayConnected ? (
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
            <EbayConnectButton
              connected={ebayConnected}
              username={ebayUsername}
              onStatusChange={setEbayConnected}
            />

            <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
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
                required.
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
              {(discogsOAuthConnected || discogsToken.trim().length > 0) ? (
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
              Discogs powers your pricing and listings. Connect your account
              with one click — you&apos;ll be sent to Discogs to log in and
              authorize VinylVault, then redirected back here.
            </p>

            <DiscogsConnectButton
              connected={discogsOAuthConnected}
              username={discogsUsername}
              oauthConfigured={discogsOAuthConfigured}
              onStatusChange={setDiscogsOAuthConnected}
            />

            {!discogsOAuthConfigured && !discogsOAuthConnected && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
                Discogs OAuth isn&apos;t configured on this server yet. Add{" "}
                <code>DISCOGS_CONSUMER_KEY</code> and{" "}
                <code>DISCOGS_CONSUMER_SECRET</code> to enable one-click connect,
                or use a personal access token below.
              </div>
            )}

            <details className="group rounded-lg border border-border bg-muted/10">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                Advanced: use a personal access token instead
              </summary>
              <div className="space-y-3 px-3 pb-3">
                <p className="text-xs text-muted-foreground">
                  Prefer not to use OAuth? Generate a free Personal Access Token
                  at{" "}
                  <a
                    href="https://www.discogs.com/settings/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    discogs.com/settings/developers
                  </a>{" "}
                  and paste it below. A connected OAuth account takes precedence
                  over this token.
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
              </div>
            </details>
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
              onClick={savePricingDefaults}
              disabled={saving}
            >
              Save Defaults
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="export" className="animate-fade-in-up stagger-5">
          <AccordionTrigger className="font-display text-lg">
            Export Collection
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download a copy of your entire catalogue. Useful for backups,
              spreadsheet analysis, or migrating elsewhere.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href="/api/albums/export?format=csv" download>
                  Export as CSV
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/api/albums/export?format=json" download>
                  Export as JSON
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              CSV opens in Excel / Google Sheets. JSON preserves arrays and
              nested structure (good for re-importing or programmatic use).
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="seller-address" className="animate-fade-in-up stagger-5">
          <AccordionTrigger className="font-display text-lg">
            Seller Address
          </AccordionTrigger>
          <AccordionContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              This is the address eBay listings ship from. Update it any time you move.
            </p>

            {/* Seller / ship-from address */}
            <div className="space-y-3 rounded-xl border border-border p-4">
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

        <AccordionItem value="about" className="animate-fade-in-up stagger-5">
          <AccordionTrigger className="font-display text-lg">
            <div className="flex items-center gap-2">
              <span>About</span>
              <span className="rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                v{APP_VERSION}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <p className="text-sm">
                <span className="font-medium text-foreground">VinylVault</span>
                <span className="text-muted-foreground"> · version </span>
                <span className="font-mono text-foreground">{APP_VERSION}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Released {CHANGELOG[0]?.date}. The version bumps any time we
                ship a release with user-facing changes.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Recent releases
              </p>
              <div className="space-y-3">
                {CHANGELOG.slice(0, 4).map((entry) => (
                  <div
                    key={entry.date}
                    className="rounded-lg border border-border bg-muted/5 p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{entry.title}</p>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {entry.version ? `v${entry.version} · ` : ""}
                        {entry.date}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {entry.items.slice(0, 4).map((item, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-xs text-muted-foreground leading-relaxed"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Full release history lives in the{" "}
                <a
                  href="https://docs.google.com/document/d/1KwS49k_32XyonLN4anqgpY7uWDpvj8kHZYVMrNUGBgs/edit?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  user guide
                </a>
                .
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
