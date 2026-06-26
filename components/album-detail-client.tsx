"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Disc2, Download, ExternalLink, RefreshCw, ShoppingBag, Sparkles, Trash2, Upload, X } from "lucide-react";
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
  convertHeicToJpeg,
  EBAY_MAX_PHOTOS,
  getOriginalPublicUrl,
  sanitizeFilename,
  validatePhoto,
} from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import type { Album, AlbumCondition, PricingResult } from "@/types";

interface AlbumDetailClientProps {
  album: Album;
  ebayConnected: boolean;
  discogsConnected: boolean;
  discogsReleaseId: number | null;
  initialPricing?: PricingResult | null;
  /** Whether the current user can edit this collection's albums. */
  canEdit?: boolean;
  /** Whether the current user owns this collection (gates marketplace actions). */
  isOwner?: boolean;
}

export function AlbumDetailClient({
  album: initialAlbum,
  ebayConnected,
  discogsConnected,
  discogsReleaseId,
  initialPricing,
  canEdit = true,
  isOwner = true,
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
  const [fetchingAI, setFetchingAI] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [listingDescription, setListingDescription] = useState(
    initialAlbum.listing_description ?? ""
  );
  const [listing, setListing] = useState(false);
  const [listingDiscogs, setListingDiscogs] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delistingEbay, setDelistingEbay] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPlatform, setManualPlatform] = useState<"ebay" | "discogs">("ebay");
  const [manualUrl, setManualUrl] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [delistingDiscogs, setDelistingDiscogs] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deletingPhotoUrl, setDeletingPhotoUrl] = useState<string | null>(null);
  const [downloadingPhotoUrl, setDownloadingPhotoUrl] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const autoSyncStartedRef = useRef(false);

  useEffect(() => {
    setAlbum(initialAlbum);
    setPricing(initialPricing ?? null);
    setListPrice(
      initialAlbum.list_price?.toString() ??
        initialAlbum.suggested_price?.toString() ??
        ""
    );
    setListingDescription(initialAlbum.listing_description ?? "");
  }, [initialAlbum, initialPricing]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  function getListPriceForListing(): number | null {
    if (!listPrice.trim()) {
      toast.error("Enter a list price before publishing this album.");
      return null;
    }
    const value = Number(listPrice);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("List price must be a positive number.");
      return null;
    }
    return value;
  }

  function getOptionalListPriceForSave(): number | null | undefined {
    if (!listPrice.trim()) return null;
    const value = Number(listPrice);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("List price must be a positive number.");
      return undefined;
    }
    return value;
  }

  function applyMarketplaceSync(
    data: {
      changed?: boolean;
      status?: string;
      soldOn?: string;
      soldPrice?: number;
      delistedFrom?: string[];
      buyerAddressRaw?: string;
    },
    options?: { silent?: boolean }
  ): boolean {
    if (!data.changed) return false;

    if (data.status === "sold") {
      setAlbum((prev) => ({
        ...prev,
        status: "sold",
        sold_price: data.soldPrice ?? prev.list_price,
        sold_at: new Date().toISOString(),
        ebay_listing_id: null,
        ebay_listing_url: null,
        discogs_listing_id: null,
        discogs_listing_url: null,
        buyer_address_raw: data.buyerAddressRaw ?? prev.buyer_address_raw,
      }));
      if (!options?.silent) {
        const platform = data.soldOn === "ebay" ? "eBay" : "Discogs";
        toast.success(`Marked as sold on ${platform}`);
      }
      router.refresh();
      return true;
    }

    if (data.delistedFrom && data.delistedFrom.length > 0) {
      setAlbum((prev) => {
        const next = { ...prev, status: (data.status ?? prev.status) as typeof prev.status };
        if (data.delistedFrom!.includes("ebay")) {
          next.ebay_listing_id = null;
          next.ebay_listing_url = null;
        }
        if (data.delistedFrom!.includes("discogs")) {
          next.discogs_listing_id = null;
          next.discogs_listing_url = null;
        }
        return next;
      });
      if (!options?.silent) {
        const names = data.delistedFrom
          .map((p) => (p === "ebay" ? "eBay" : "Discogs"))
          .join(" and ");
        toast.info(`No longer listed on ${names} — catalogue updated`);
      }
      router.refresh();
      return true;
    }

    return false;
  }

  // Quietly reconcile marketplace state when opening an album that still
  // shows listing IDs — catches delists done directly on eBay/Discogs.
  useEffect(() => {
    if (!isOwner || album.status === "sold") return;
    if (!album.ebay_listing_id && !album.discogs_listing_id) return;
    if (autoSyncStartedRef.current) return;
    autoSyncStartedRef.current = true;

    let cancelled = false;

    (async () => {
      const res = await fetch("/api/sync/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId: album.id }),
      });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      applyMarketplaceSync(data);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per album page
  }, [album.id, isOwner]);

  async function handleFetchPrices() {
    if (!canEdit) return;
    setFetching(true);
    // Manual refresh always bypasses the 24h cache so the user gets live
    // Discogs/eBay data on demand.
    const res = await fetch("/api/pricing/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id, force: true }),
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

  async function handleAIPricing() {
    if (!canEdit) return;
    setFetchingAI(true);
    const res = await fetch("/api/pricing/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setPricing((prev) => ({
        ...(prev ?? { suggestedPrice: 0, confidence: "low" as const }),
        aiSuggestedPrice: data.suggestedPrice,
        aiPriceRange: data.priceRange,
        aiReasoning: data.reasoning,
        aiStrategy: data.strategy,
        aiConfidence: data.confidence,
      }));
      setListPrice(data.suggestedPrice.toString());
      toast.success(`AI suggests $${data.suggestedPrice.toFixed(2)} · ${data.strategy}`);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "AI pricing failed");
    }
    setFetchingAI(false);
  }

  async function handleListOnEbay() {
    const price = getListPriceForListing();
    if (price == null) return;
    setListing(true);
    const res = await fetch("/api/ebay/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id, listPrice: price }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.stub) {
        toast.warning(
          data.message ??
            "Preview only — eBay listing isn't wired up yet, so nothing was posted.",
          { duration: 10000 }
        );
        router.refresh();
      } else {
        setAlbum((prev) => ({
          ...prev,
          status: "listed",
          ebay_listing_id: data.listingId,
          ebay_listing_url: data.listingUrl,
          list_price: price,
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
    const price = getListPriceForListing();
    if (price == null) return;
    setListingDiscogs(true);
    const res = await fetch("/api/discogs/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id, listPrice: price }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlbum((prev) => ({
        ...prev,
        status: "listed",
        discogs_listing_id: String(data.listingId),
        discogs_listing_url: data.listingUrl,
        list_price: price,
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

  async function handleSaveManualListing() {
    const price = parseFloat(manualPrice);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid listing price.");
      return;
    }
    const url = manualUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Listing URL must start with http:// or https://");
      return;
    }

    setSavingManual(true);
    const roundedPrice = Math.round(price * 100) / 100;
    const manualId = `manual-${Date.now()}`;
    const updates =
      manualPlatform === "ebay"
        ? {
            ebay_listing_id: manualId,
            ebay_listing_url: url || null,
            list_price: roundedPrice,
            status: "listed" as const,
          }
        : {
            discogs_listing_id: manualId,
            discogs_listing_url: url || null,
            list_price: roundedPrice,
            status: "listed" as const,
          };

    const { error } = await supabase
      .from("albums")
      .update(updates)
      .eq("id", album.id);

    if (error) {
      toast.error(error.message);
      setSavingManual(false);
      return;
    }

    setAlbum((prev) => ({ ...prev, ...updates }));
    setManualOpen(false);
    setManualUrl("");
    setManualPrice("");
    toast.success(
      `Tracked as manually listed on ${manualPlatform === "ebay" ? "eBay" : "Discogs"}`
    );
    router.refresh();
    setSavingManual(false);
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
      if (!applyMarketplaceSync(data)) {
        toast.info("Still listed — no sale detected on either platform");
      }
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Sync failed");
    }
    setSyncing(false);
  }

  async function handleGenerateDescription() {
    if (!canEdit) return;
    setGeneratingDesc(true);
    const res = await fetch("/api/albums/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id, platform: "both" }),
    });
    if (res.ok) {
      const data = await res.json();
      setListingDescription(data.description);
      setAlbum((prev) => ({ ...prev, listing_description: data.description }));
      toast.success("AI description generated");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Description generation failed");
    }
    setGeneratingDesc(false);
  }

  async function handleDelistEbay() {
    setDelistingEbay(true);
    const res = await fetch("/api/ebay/delist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id }),
    });
    if (res.ok) {
      setAlbum((prev) => ({ ...prev, ebay_listing_id: null, ebay_listing_url: null, status: prev.discogs_listing_id ? "listed" : "unlisted" }));
      toast.success("Removed from eBay");
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to delist from eBay");
    }
    setDelistingEbay(false);
  }

  async function handleDelistDiscogs() {
    setDelistingDiscogs(true);
    const res = await fetch("/api/discogs/delist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: album.id }),
    });
    if (res.ok) {
      setAlbum((prev) => ({ ...prev, discogs_listing_id: null, discogs_listing_url: null, status: prev.ebay_listing_id ? "listed" : "unlisted" }));
      toast.success("Removed from Discogs");
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to delist from Discogs");
    }
    setDelistingDiscogs(false);
  }

  async function handleDelete() {
    if (!canEdit) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    const res = await fetch("/api/albums/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumIds: [album.id] }),
    });
    if (res.ok) {
      toast.success("Album deleted");
      router.push("/albums");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Delete failed");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleSave() {
    if (!canEdit) return;
    const price = getOptionalListPriceForSave();
    if (price === undefined) return;
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
        list_price: price,
        listing_description: listingDescription || null,
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
    if (!canEdit) {
      toast.error("You have view-only access to this collection.");
      return;
    }

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

    for (const rawFile of toUpload) {
      let file = rawFile;
      try {
        file = await convertHeicToJpeg(rawFile);
      } catch {
        toast.error(`${rawFile.name}: couldn't convert HEIC/HEIF to JPEG.`);
        continue;
      }

      const validation = await validatePhoto(file);
      if (!validation.ok) {
        toast.error(validation.errors.join(" "), { duration: 7000 });
        continue;
      }
      validation.warnings.forEach((w) =>
        toast.warning(w, { duration: 7000 })
      );

      const safeName = sanitizeFilename(file.name);
      // Store under the collection owner's folder so shared editors land in the
      // right bucket path (storage RLS keys on the owner id).
      const path = `${album.user_id}/${album.id}/${Date.now()}-${safeName}`;

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

  // Build a clean filename for a downloaded photo: artist - title (N).ext
  // Folder-friendly characters only, stable index across the grid.
  function buildDownloadName(url: string, index: number): string {
    const safe = (s: string) =>
      (s || "")
        .replace(/[^\w\s\-]+/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 60);
    let ext = "jpg";
    try {
      const pathname = new URL(url).pathname;
      const m = pathname.match(/\.([a-zA-Z0-9]+)$/);
      if (m && m[1].length <= 5) ext = m[1].toLowerCase();
    } catch {
      // Non-URL string — fall back to jpg.
    }
    const base = `${safe(album.artist)}-${safe(album.title)}`;
    return `${base}_${String(index + 1).padStart(2, "0")}.${ext}`;
  }

  async function fetchAsBlob(url: string): Promise<Blob> {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
    return res.blob();
  }

  function triggerDownload(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a beat to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function handleDownloadPhoto(url: string, index: number) {
    setDownloadingPhotoUrl(url);
    try {
      const blob = await fetchAsBlob(url);
      triggerDownload(blob, buildDownloadName(url, index));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't download this photo"
      );
    } finally {
      setDownloadingPhotoUrl(null);
    }
  }

  async function handleDownloadAllPhotos() {
    const urls = album.photo_urls ?? [];
    if (urls.length === 0) return;

    setDownloadingAll(true);
    try {
      // Single photo: skip the ZIP, just download directly. Same UX as the
      // per-photo button — saves a meaningless one-file archive.
      if (urls.length === 1) {
        const blob = await fetchAsBlob(urls[0]);
        triggerDownload(blob, buildDownloadName(urls[0], 0));
        return;
      }

      // Lazy-load jszip so it only ships to album pages that actually
      // trigger a download — keeps the rest of the bundle small.
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      toast.info(`Packaging ${urls.length} photos…`);

      // Sequential fetch so we don't hammer the connection / Supabase egress
      // all at once. eBay caps at 24 photos per listing, so worst case ~24
      // sequential fetches — still snappy.
      let downloaded = 0;
      for (let i = 0; i < urls.length; i++) {
        try {
          const blob = await fetchAsBlob(urls[i]);
          zip.file(buildDownloadName(urls[i], i), blob);
          downloaded += 1;
        } catch {
          // Best-effort: skip an unreachable photo, continue with the rest.
        }
      }

      if (downloaded === 0) {
        toast.error("Couldn't download any photos. Check your connection.");
        return;
      }

      const archive = await zip.generateAsync({ type: "blob" });
      const safe = (s: string) =>
        (s || "").replace(/[^\w\s\-]+/g, "").trim().replace(/\s+/g, "_");
      const zipName = `${safe(album.artist)}-${safe(album.title)}_photos.zip`;
      triggerDownload(archive, zipName);

      const skipped = urls.length - downloaded;
      toast.success(
        skipped > 0
          ? `Downloaded ${downloaded} of ${urls.length} photos (${skipped} couldn't be fetched).`
          : `Downloaded ${downloaded} photos.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't build the ZIP archive"
      );
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleDeletePhoto(url: string) {
    if (!canEdit) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this cover photo? This can't be undone.")
    ) {
      return;
    }

    setDeletingPhotoUrl(url);
    try {
      const existing = album.photo_urls ?? [];
      const next = existing.filter((u) => u !== url);

      // Update the album row first — that's the source of truth the UI
      // reads from. Storage cleanup is best-effort below.
      const { error: updateError } = await supabase
        .from("albums")
        .update({ photo_urls: next })
        .eq("id", album.id);
      if (updateError) {
        toast.error(`Couldn't remove the photo: ${updateError.message}`);
        return;
      }
      setAlbum((prev) => ({ ...prev, photo_urls: next }));

      // Delete the underlying file from storage too so we don't accumulate
      // orphans. URL shape: .../storage/v1/object/public/album-photos/{path}
      try {
        const match = url.match(/\/object\/public\/album-photos\/(.+)$/);
        if (match) {
          const storagePath = decodeURIComponent(match[1]);
          await supabase.storage.from("album-photos").remove([storagePath]);
        }
      } catch {
        // Non-fatal — the URL is already gone from the album row.
      }

      toast.success("Photo deleted");
    } finally {
      setDeletingPhotoUrl(null);
    }
  }

  const multiplier = CONDITION_MULTIPLIERS[album.condition];
  const profit =
    album.sold_price && album.purchase_price
      ? album.sold_price - album.purchase_price
      : null;
  const effectiveDiscogsReleaseId =
    album.discogs_release_id ?? discogsReleaseId ?? pricing?.discogsReleaseId ?? null;

  return (
    <div className="animate-fade-in">
      <Link
        href="/albums"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
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

      {!canEdit && (
        <div className="mt-4 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground animate-fade-in">
          You have <span className="font-medium text-foreground">view-only</span>{" "}
          access to this shared collection. Editing is disabled.
        </div>
      )}
      {canEdit && !isOwner && (
        <div className="mt-4 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground animate-fade-in">
          You can manage this shared album. Marketplace listing and shipping
          actions are available to the collection owner.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <Label className="mb-3 block">Photos</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(album.photo_urls ?? []).map((url, i) => (
                <div
                  key={i}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-input"
                >
                  {/* Vercel image proxy resizes + caches at the edge, so this
                      doesn't hammer Supabase egress every time someone opens
                      the album. Photo URLs are unique-per-upload (timestamp
                      + random), so caching forever is safe. */}
                  <Image
                    src={url}
                    alt={`${album.artist} — ${album.title}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 200px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(url)}
                    title="Click to expand"
                    className="absolute inset-0 cursor-zoom-in transition-transform hover:scale-[1.02]"
                  >
                    <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDownloadPhoto(url, i);
                    }}
                    disabled={downloadingPhotoUrl === url}
                    title="Download this photo"
                    aria-label="Download this photo"
                    className={cn(
                      "absolute z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-accent/80 focus:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-100 top-1",
                      canEdit ? "right-8" : "right-1"
                    )}
                  >
                    {downloadingPhotoUrl === url ? (
                      <VinylSpinner size="xs" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeletePhoto(url);
                      }}
                      disabled={deletingPhotoUrl === url}
                      title="Delete this photo"
                      aria-label="Delete this photo"
                      className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-red-500/80 focus:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-100"
                    >
                      {deletingPhotoUrl === url ? (
                        <VinylSpinner size="xs" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (album.photo_urls ?? []).length < EBAY_MAX_PHOTOS && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border transition-colors hover:border-accent/50">
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
            {(album.photo_urls?.length ?? 0) > 0 && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadAllPhotos}
                  disabled={downloadingAll}
                  className="gap-2"
                  title="Download every photo for this album. Useful for manual listings on eBay/Discogs."
                >
                  {downloadingAll ? (
                    <>
                      <VinylSpinner size="xs" />
                      Packaging…
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      {(album.photo_urls?.length ?? 0) === 1
                        ? "Download photo"
                        : `Download all ${album.photo_urls?.length} photos`}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-border p-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={album.title}
                disabled={!canEdit}
                onChange={(e) =>
                  setAlbum((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Artist</Label>
              <Input
                value={album.artist}
                disabled={!canEdit}
                onChange={(e) =>
                  setAlbum((prev) => ({ ...prev, artist: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Genre</Label>
                <Input
                  value={album.genre ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setAlbum((prev) => ({ ...prev, genre: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={album.condition}
                  disabled={!canEdit}
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
                disabled={!canEdit}
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
                disabled={!canEdit}
                onChange={(e) =>
                  setAlbum((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
            {/* AI Listing Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  Listing Description
                </Label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={generatingDesc || !canEdit}
                  className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/25 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {generatingDesc ? (
                    <><VinylSpinner size="xs" />Generating…</>
                  ) : (
                    <><Sparkles className="h-3 w-3" />{listingDescription ? "Regenerate" : "Generate with AI"}</>
                  )}
                </button>
              </div>
              {generatingDesc && (
                <div className="space-y-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-medium text-accent">
                    <VinylSpinner size="xs" />
                    <span>Writing your listing description…</span>
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <div className="h-2.5 w-full rounded-full bg-accent/15 animate-pulse-soft" />
                    <div className="h-2.5 w-[92%] rounded-full bg-accent/15 animate-pulse-soft stagger-1" />
                    <div className="h-2.5 w-[80%] rounded-full bg-accent/15 animate-pulse-soft stagger-2" />
                    <div className="h-2.5 w-[88%] rounded-full bg-accent/15 animate-pulse-soft stagger-3" />
                  </div>
                </div>
              )}
              <Textarea
                value={listingDescription}
                disabled={!canEdit}
                onChange={(e) => setListingDescription(e.target.value)}
                rows={5}
                placeholder="Click Generate with AI to write a sales-optimised description, or type your own…"
                className="resize-none text-sm"
              />
              {listingDescription && (
                <p className="text-[10px] text-muted-foreground">
                  This description will be used for eBay and Discogs listings automatically.
                </p>
              )}
            </div>

            {canEdit && (
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
            )}
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

          {/* AI pricing card — shown once AI has been queried */}
          {pricing?.aiSuggestedPrice != null && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 overflow-hidden animate-fade-in-up">
              <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-accent/15">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="font-display text-sm font-semibold text-accent">AI Price Analysis</span>
                {pricing.aiStrategy && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    pricing.aiStrategy === "premium"
                      ? "bg-green-500/15 text-green-400"
                      : pricing.aiStrategy === "clearance"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-blue-500/15 text-blue-400"
                  }`}>
                    {pricing.aiStrategy}
                  </span>
                )}
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Suggested Price</p>
                    <p className="font-display text-3xl font-bold text-accent tabular-nums">
                      {formatCurrency(pricing.aiSuggestedPrice)}
                    </p>
                  </div>
                  {pricing.aiPriceRange && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Range</p>
                      <p className="text-sm font-medium tabular-nums">
                        {formatCurrency(pricing.aiPriceRange.low)} – {formatCurrency(pricing.aiPriceRange.high)}
                      </p>
                    </div>
                  )}
                </div>
                {pricing.aiReasoning && (
                  <p className="text-xs text-muted-foreground leading-relaxed border-t border-accent/15 pt-3">
                    {pricing.aiReasoning}
                  </p>
                )}
                {pricing.aiConfidence && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-end gap-0.5">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-sm ${
                            pricing.aiConfidence === "high"
                              ? "bg-accent"
                              : pricing.aiConfidence === "medium" && i <= 2
                                ? "bg-accent"
                                : i === 1
                                  ? "bg-accent"
                                  : "bg-accent/25"
                          }`}
                          style={{ height: i === 1 ? 6 : i === 2 ? 9 : 12 }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {pricing.aiConfidence} confidence
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action panel */}
          <div className="rounded-xl border border-border bg-card animate-fade-in-up stagger-2 overflow-hidden">
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

            <div className="border-t border-border" />

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
                    disabled={!canEdit}
                  />
                </div>
                {/* Refresh market prices */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleFetchPrices}
                  disabled={fetching || !canEdit}
                  title="Refresh Discogs + eBay prices"
                  className="shrink-0 h-10 w-10"
                >
                  {fetching ? <VinylSpinner size="xs" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                {/* AI price analysis */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleAIPricing}
                  disabled={fetchingAI || !canEdit}
                  title="Get AI price analysis"
                  className="shrink-0 h-10 w-10 border-accent/30 text-accent hover:bg-accent/10 hover:border-accent/60"
                >
                  {fetchingAI ? <VinylSpinner size="xs" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
              {fetchingAI && (
                <p className="text-xs text-muted-foreground animate-pulse">
                  AI is analysing market data…
                </p>
              )}
            </div>

            {/* Platform listing buttons */}
            {isOwner && album.status !== "sold" && (
              <div className="border-t border-border px-5 py-4 space-y-2">
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
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-green-400">Listed on eBay</p>
                        <a href={album.ebay_listing_url ?? "#"} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-accent transition-colors">
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                      <button onClick={handleDelistEbay} disabled={delistingEbay}
                        className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                        title="Remove eBay listing">
                        {delistingEbay ? <VinylSpinner size="xs" /> : "Delist"}
                      </button>
                    </div>
                  )}

                  {!album.discogs_listing_id ? (
                    <Button
                      variant="outline"
                      onClick={handleListOnDiscogs}
                      disabled={
                        listingDiscogs ||
                        !discogsConnected ||
                        !effectiveDiscogsReleaseId
                      }
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
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-green-400">Listed on Discogs</p>
                        <a href={album.discogs_listing_url ?? "#"} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-accent transition-colors">
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                      <button onClick={handleDelistDiscogs} disabled={delistingDiscogs}
                        className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                        title="Remove Discogs listing">
                        {delistingDiscogs ? <VinylSpinner size="xs" /> : "Delist"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Manual listing — record an external listing without posting via API */}
                {!album.ebay_listing_id || !album.discogs_listing_id ? (
                  <div className="pt-2">
                    {!manualOpen ? (
                      <button
                        onClick={() => {
                          const defaultPlatform: "ebay" | "discogs" =
                            !album.ebay_listing_id ? "ebay" : "discogs";
                          setManualPlatform(defaultPlatform);
                          setManualPrice(
                            (album.list_price ?? album.suggested_price ?? "").toString()
                          );
                          setManualOpen(true);
                        }}
                        className="text-xs text-muted-foreground hover:text-accent transition-colors"
                      >
                        Already listed it yourself? Track it manually →
                      </button>
                    ) : (
                      <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/10 p-3">
                        <p className="text-xs font-medium">Track a manual listing</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setManualPlatform("ebay")}
                            disabled={!!album.ebay_listing_id}
                            className={`rounded-md border px-3 py-2 text-xs transition-colors ${
                              manualPlatform === "ebay"
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-border text-muted-foreground hover:text-foreground"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            eBay
                          </button>
                          <button
                            type="button"
                            onClick={() => setManualPlatform("discogs")}
                            disabled={!!album.discogs_listing_id}
                            className={`rounded-md border px-3 py-2 text-xs transition-colors ${
                              manualPlatform === "discogs"
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-border text-muted-foreground hover:text-foreground"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            Discogs
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="manual-url" className="text-xs">Listing URL (optional)</Label>
                          <Input
                            id="manual-url"
                            type="url"
                            placeholder="https://..."
                            value={manualUrl}
                            onChange={(e) => setManualUrl(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="manual-price" className="text-xs">List Price ($)</Label>
                          <Input
                            id="manual-price"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={manualPrice}
                            onChange={(e) => setManualPrice(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveManualListing}
                            disabled={savingManual}
                          >
                            {savingManual ? <VinylSpinner size="xs" /> : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setManualOpen(false)}
                            disabled={savingManual}
                          >
                            Cancel
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          This just records the listing in VinylVault — it does not post anything to {manualPlatform === "ebay" ? "eBay" : "Discogs"}. Use this if you listed it yourself outside VinylVault.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Check if sold */}
                {(album.ebay_listing_id || album.discogs_listing_id) && (
                  <Button
                    variant="ghost"
                    className="mt-1 w-full text-muted-foreground hover:text-foreground"
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
                {discogsConnected && !effectiveDiscogsReleaseId && !album.discogs_listing_id && (
                  <p className="text-xs text-muted-foreground">
                    Refresh prices first so VinylVault can identify the Discogs release.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sold card */}
          {album.status === "sold" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in-up">
              {/* Sale summary */}
              <div className="p-5">
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

            </div>
          )}
          {/* Delete album */}
          {canEdit && (
          <div className="flex items-center justify-end gap-3 pt-2">
            {confirmDelete && (
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
                confirmDelete
                  ? "font-medium text-red-400 hover:text-red-300"
                  : "text-muted-foreground hover:text-red-400"
              }`}
            >
              {deleting ? <VinylSpinner size="xs" /> : <Trash2 className="h-3.5 w-3.5" />}
              {confirmDelete ? "Confirm — delete this album?" : "Delete album"}
            </button>
          </div>
          )}
        </div>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* Close button. z-[60] sits above the image and its wrapper so it
              can always be clicked. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxUrl(null);
            }}
            aria-label="Close (Esc)"
            title="Close (Esc)"
            className="fixed right-4 top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition-colors hover:border-white/40 hover:bg-black/90"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Plain <img> in the lightbox (not next/image) — the wrapper Next
              renders sometimes blocks pointer events on the surrounding
              backdrop, making the modal feel un-closeable. Direct img is
              simple and predictable; egress hit is minimal because lightbox
              is opt-in. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt={`${album.artist} — ${album.title}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
          {/* Small hint at the bottom so users know they can press Esc or
              click outside. */}
          <p
            className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white/70"
            aria-hidden="true"
          >
            Click outside or press Esc to close
          </p>
        </div>
      )}
    </div>
  );
}
