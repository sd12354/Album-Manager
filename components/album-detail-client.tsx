"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Disc2, ExternalLink, RefreshCw, ShoppingBag, Upload } from "lucide-react";
import { toast } from "sonner";
import { AlbumStatusBadge } from "@/components/album-status-badge";
import { ConditionBadge } from "@/components/condition-badge";
import { PricingCard } from "@/components/pricing-card";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONDITION_MULTIPLIERS } from "@/lib/pricing";
import {
  ACCEPT_ATTRIBUTE,
  EBAY_MAX_PHOTOS,
  getOriginalPublicUrl,
  sanitizeFilename,
  validatePhoto,
} from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Album, AlbumCondition, PricingResult } from "@/types";

interface AlbumDetailClientProps {
  album: Album;
  ebayConnected: boolean;
  discogsConnected: boolean;
  discogsReleaseId: number | null;
  initialPricing?: PricingResult | null;
}

export function AlbumDetailClient({
  album: initialAlbum,
  ebayConnected,
  discogsConnected,
  discogsReleaseId,
  initialPricing,
}: AlbumDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [album, setAlbum] = useState(initialAlbum);
  const [pricing, setPricing] = useState<PricingResult | null>(
    initialPricing ?? null
  );
  const [listPrice, setListPrice] = useState(
    album.list_price?.toString() ?? album.suggested_price?.toString() ?? ""
  );
  const [fetching, setFetching] = useState(false);
  const [listing, setListing] = useState(false);
  const [listingDiscogs, setListingDiscogs] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFetchPrices() {
    setFetching(true);
    const res = await fetch("/api/pricing/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id }),
    });
    if (res.ok) {
      const data: PricingResult = await res.json();
      setPricing(data);
      if (data.suggestedPrice > 0) {
        setListPrice(data.suggestedPrice.toString());
      }
      const sourceLabel =
        data.suggestionSource === "discogs-condition"
          ? "Discogs (graded)"
          : data.suggestionSource === "discogs-median"
            ? "Discogs (median)"
            : data.suggestionSource === "ebay-active"
              ? "eBay (active asks)"
              : null;
      if (data.notice && !data.suggestionSource) {
        toast.warning(data.notice, { duration: 10000 });
      } else if (data.notice) {
        toast.info(data.notice, { duration: 8000 });
      } else if (sourceLabel) {
        toast.success(`Priced via ${sourceLabel}`);
      } else {
        toast.success("Prices updated");
      }
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to fetch prices");
    }
    setFetching(false);
  }

  async function handleListOnEbay() {
    setListing(true);
    const res = await fetch("/api/ebay/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id, listPrice: parseFloat(listPrice) }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.stub) {
        toast.warning(
          data.message ??
            "Preview only — eBay listing isn't wired up yet, so nothing was posted.",
          { duration: 10000 }
        );
      } else {
        setAlbum((prev) => ({
          ...prev,
          status: "listed",
          ebay_listing_id: data.listingId,
          ebay_listing_url: data.listingUrl,
          list_price: parseFloat(listPrice),
        }));
        toast.success("Listed on eBay");
        router.refresh();
      }
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to list on eBay");
    }
    setListing(false);
  }

  async function handleListOnDiscogs() {
    setListingDiscogs(true);
    const res = await fetch("/api/discogs/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id, listPrice: parseFloat(listPrice) }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlbum((prev) => ({
        ...prev,
        status: "listed",
        discogs_listing_id: String(data.listingId),
        discogs_listing_url: data.listingUrl,
        list_price: parseFloat(listPrice),
      }));
      if (data.warning) {
        toast.warning(data.warning, { duration: 12000 });
      } else {
        toast.success("Listed on Discogs");
      }
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to list on Discogs");
    }
    setListingDiscogs(false);
  }

  async function handleSyncSales() {
    setSyncing(true);
    const res = await fetch("/api/sync/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.changed && data.status === "sold") {
        setAlbum((prev) => ({
          ...prev,
          status: "sold",
          sold_price: data.soldPrice ?? prev.list_price,
          sold_at: new Date().toISOString(),
        }));
        toast.success(
          `Sold on ${data.soldOn === "ebay" ? "eBay" : "Discogs"} — other listing cancelled`
        );
        router.refresh();
      } else {
        toast.info("No sale detected yet on either platform");
      }
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Sync failed");
    }
    setSyncing(false);
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("albums")
      .update({
        title: album.title,
        artist: album.artist,
        genre: album.genre,
        condition: album.condition,
        catalog_number: album.catalog_number,
        notes: album.notes,
        list_price: listPrice ? parseFloat(listPrice) : null,
      })
      .eq("id", album.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Album saved");
      router.refresh();
    }
    setSaving(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const existing = album.photo_urls ?? [];
    const remainingSlots = EBAY_MAX_PHOTOS - existing.length;
    if (remainingSlots <= 0) {
      toast.error(`You've reached the ${EBAY_MAX_PHOTOS}-photo limit.`);
      return;
    }
    const toUpload = files.slice(0, remainingSlots);
    if (files.length > toUpload.length) {
      toast.warning(
        `Only uploading the first ${toUpload.length} of ${files.length} photos (eBay caps listings at ${EBAY_MAX_PHOTOS}).`
      );
    }

    setUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of toUpload) {
      const validation = await validatePhoto(file);
      if (!validation.ok) {
        toast.error(validation.errors.join(" "), { duration: 7000 });
        continue;
      }
      validation.warnings.forEach((w) =>
        toast.warning(w, { duration: 7000 })
      );

      const safeName = sanitizeFilename(file.name);
      const path = `${user.id}/${album.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("album-photos")
        .upload(path, file, {
          // Preserve the original binary and Content-Type so eBay (and any
          // other consumer) downloads byte-for-byte identical pixels.
          contentType: file.type,
          upsert: false,
          cacheControl: "31536000",
        });

      if (uploadError) {
        toast.error(`${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("album-photos")
        .getPublicUrl(path);

      uploadedUrls.push(getOriginalPublicUrl(urlData.publicUrl));
    }

    if (uploadedUrls.length > 0) {
      const newUrls = [...existing, ...uploadedUrls];
      const { error: updateError } = await supabase
        .from("albums")
        .update({ photo_urls: newUrls })
        .eq("id", album.id);

      if (updateError) {
        toast.error(`Failed to save photos: ${updateError.message}`);
      } else {
        setAlbum((prev) => ({ ...prev, photo_urls: newUrls }));
        toast.success(
          uploadedUrls.length === 1
            ? "Photo uploaded at full quality"
            : `${uploadedUrls.length} photos uploaded at full quality`
        );
      }
    }

    setUploading(false);
  }

  const multiplier = CONDITION_MULTIPLIERS[album.condition];
  const profit =
    album.sold_price && album.purchase_price
      ? album.sold_price - album.purchase_price
      : null;

  return (
    <div className="animate-fade-in">
      <Link
        href="/albums"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-[#F5F4F0]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Catalogue
      </Link>

      <div className="flex items-start justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">{album.title}</h1>
          <p className="mt-1.5 text-lg text-muted-foreground">{album.artist}</p>
        </div>
        <AlbumStatusBadge status={album.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <Label className="mb-3 block">Photos</Label>
            <div className="grid grid-cols-4 gap-2">
              {(album.photo_urls ?? []).map((url, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg border border-white/8 bg-[#1A1A1C] bg-cover bg-center"
                  style={{ backgroundImage: `url(${url})` }}
                />
              ))}
              {(album.photo_urls ?? []).length < EBAY_MAX_PHOTOS && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/10 transition-colors hover:border-accent/50">
                  {uploading ? (
                    <VinylSpinner size="md" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="mt-1 text-xs text-muted-foreground">
                        Add
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              JPEG, PNG, WebP, TIFF — stored at full quality, passed to eBay as-is. Min 500px, 1600px+ recommended.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-white/8 p-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={album.title}
                onChange={(e) =>
                  setAlbum((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Artist</Label>
              <Input
                value={album.artist}
                onChange={(e) =>
                  setAlbum((prev) => ({ ...prev, artist: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Genre</Label>
                <Input
                  value={album.genre ?? ""}
                  onChange={(e) =>
                    setAlbum((prev) => ({ ...prev, genre: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={album.condition}
                  onValueChange={(v) =>
                    setAlbum((prev) => ({
                      ...prev,
                      condition: v as AlbumCondition,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Mint", "Great", "Good", "Fair", "Poor"] as const).map(
                      (c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catalog #</Label>
              <Input
                value={album.catalog_number ?? ""}
                onChange={(e) =>
                  setAlbum((prev) => ({
                    ...prev,
                    catalog_number: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={album.notes ?? ""}
                onChange={(e) =>
                  setAlbum((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <VinylSpinner size="xs" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Pricing notice */}
          {pricing?.notice && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200 animate-fade-in-up">
              <p className="font-medium">Pricing notice</p>
              <p className="mt-1 text-amber-200/80">{pricing.notice}</p>
              {pricing.discogsReleaseId && (
                <a
                  href={`https://www.discogs.com/release/${pricing.discogsReleaseId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-amber-200 underline-offset-2 hover:underline"
                >
                  Verify match on Discogs →
                </a>
              )}
            </div>
          )}

          {/* Pricing data */}
          {pricing && <PricingCard pricing={pricing} />}

          {/* Action panel */}
          <div className="rounded-xl border border-white/8 bg-card animate-fade-in-up stagger-2 overflow-hidden">
            {/* Suggested price */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Suggested Price
                </p>
                <p className="mt-1 font-display text-4xl font-bold text-accent tabular-nums">
                  {formatCurrency(pricing?.suggestedPrice ?? album.suggested_price)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {multiplier}× condition multiplier
                </p>
              </div>
              <ConditionBadge condition={album.condition} />
            </div>

            <div className="border-t border-white/8" />

            {/* Price input + refresh */}
            <div className="px-5 pt-4 pb-4 space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">List Price (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleFetchPrices}
                  disabled={fetching}
                  title="Refresh prices"
                  className="shrink-0 h-10 w-10"
                >
                  {fetching ? (
                    <VinylSpinner size="xs" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Platform listing buttons */}
            {album.status !== "sold" && (
              <div className="border-t border-white/8 px-5 py-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  List on
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {!album.ebay_listing_id ? (
                    <Button
                      onClick={handleListOnEbay}
                      disabled={listing || !ebayConnected}
                      className="w-full justify-center gap-2"
                    >
                      {listing ? (
                        <VinylSpinner size="xs" />
                      ) : (
                        <ShoppingBag className="h-4 w-4" />
                      )}
                      eBay
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-green-400">Listed on eBay</p>
                        <a
                          href={album.ebay_listing_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-accent transition-colors"
                        >
                          View listing <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {!album.discogs_listing_id ? (
                    <Button
                      variant="outline"
                      onClick={handleListOnDiscogs}
                      disabled={listingDiscogs || !discogsConnected || !discogsReleaseId}
                      className="w-full justify-center gap-2"
                    >
                      {listingDiscogs ? (
                        <VinylSpinner size="xs" />
                      ) : (
                        <Disc2 className="h-4 w-4" />
                      )}
                      Discogs
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-green-400">Listed on Discogs</p>
                        <a
                          href={album.discogs_listing_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-accent transition-colors"
                        >
                          View listing <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Check if sold */}
                {(album.ebay_listing_id || album.discogs_listing_id) && (
                  <Button
                    variant="ghost"
                    className="mt-1 w-full text-muted-foreground hover:text-[#F5F4F0]"
                    onClick={handleSyncSales}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <>
                        <VinylSpinner size="xs" />
                        Checking platforms...
                      </>
                    ) : (
                      "Check if sold on any platform"
                    )}
                  </Button>
                )}

                {/* Connection hints */}
                {!ebayConnected && !album.ebay_listing_id && (
                  <p className="text-xs text-muted-foreground">
                    Connect eBay in{" "}
                    <a href="/settings" className="text-accent hover:underline">
                      Settings
                    </a>{" "}
                    to list on eBay.
                  </p>
                )}
                {!discogsConnected && !album.discogs_listing_id && (
                  <p className="text-xs text-muted-foreground">
                    Add a Discogs token in{" "}
                    <a href="/settings" className="text-accent hover:underline">
                      Settings
                    </a>{" "}
                    to list on Discogs.
                  </p>
                )}
                {discogsConnected && !discogsReleaseId && !album.discogs_listing_id && (
                  <p className="text-xs text-muted-foreground">
                    Refresh prices first so VinylVault can identify the Discogs release.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sold card */}
          {album.status === "sold" && (
            <div className="rounded-xl border border-white/8 bg-card p-5 animate-fade-in-up">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sold
              </p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums">
                {formatCurrency(album.sold_price)}
              </p>
              {album.sold_at && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(album.sold_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              {profit !== null && (
                <p
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                    profit >= 0
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {profit >= 0 ? "+" : ""}
                  {formatCurrency(profit)} vs purchase price
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
