"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Upload } from "lucide-react";
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
  initialPricing?: PricingResult | null;
}

export function AlbumDetailClient({
  album: initialAlbum,
  ebayConnected,
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

      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <h1 className="font-display text-3xl font-bold">{album.title}</h1>
          <p className="mt-1 text-muted-foreground">{album.artist}</p>
        </div>
        <AlbumStatusBadge status={album.status} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
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
              Originals are stored at full quality and passed straight through to eBay (no resizing or re-encoding). JPEG, PNG, WebP, GIF, BMP, or TIFF — at least 500px on the longest side, 1600px+ recommended.
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

        <div className="space-y-6">
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
          {pricing && <PricingCard pricing={pricing} />}

          <div className="rounded-xl border border-white/8 p-6 animate-fade-in-up stagger-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suggested Price</p>
                <p className="font-display text-4xl font-bold text-accent tabular-nums">
                  {formatCurrency(
                    pricing?.suggestedPrice ?? album.suggested_price
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {multiplier}× condition multiplier applied
                </p>
              </div>
              <ConditionBadge condition={album.condition} />
            </div>

            <div className="mt-4 space-y-2">
              <Label>List Price Override</Label>
              <Input
                type="number"
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleFetchPrices}
                disabled={fetching}
              >
                {fetching ? (
                  <>
                    <VinylSpinner size="xs" />
                    Fetching prices...
                  </>
                ) : (
                  "Fetch Latest Prices"
                )}
              </Button>
              {album.status !== "listed" && album.status !== "sold" && (
                <Button
                  onClick={handleListOnEbay}
                  disabled={listing || !ebayConnected}
                >
                  {listing ? (
                    <>
                      <VinylSpinner size="xs" />
                      Listing...
                    </>
                  ) : (
                    "List on eBay"
                  )}
                </Button>
              )}
            </div>

            {!ebayConnected && (
              <p className="mt-2 text-xs text-muted-foreground">
                Connect your eBay account in Settings to list albums.
              </p>
            )}
          </div>

          {album.status === "listed" && album.ebay_listing_url && (
            <div className="rounded-xl border border-white/8 p-6">
              <p className="text-sm font-medium">Listed on eBay</p>
              <a
                href={album.ebay_listing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                View on eBay <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {album.status === "sold" && (
            <div className="rounded-xl border border-white/8 p-6 animate-fade-in-up">
              <p className="text-sm font-medium">Sold</p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums">
                {formatCurrency(album.sold_price)}
              </p>
              {album.sold_at && (
                <p className="text-sm text-muted-foreground">
                  {new Date(album.sold_at).toLocaleDateString()}
                </p>
              )}
              {profit !== null && (
                <p
                  className={`mt-2 text-sm font-medium ${
                    profit >= 0 ? "text-green-400" : "text-red-400"
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
