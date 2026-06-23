"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Disc2, Eye, Plus, Search, Trash2, Users } from "lucide-react";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { toast } from "sonner";
import { AddAlbumDrawer } from "@/components/add-album-drawer";
import { AlbumStatusBadge } from "@/components/album-status-badge";
import { ConditionBadge } from "@/components/condition-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Album, AlbumCondition, AlbumStatus } from "@/types";

interface CatalogueClientProps {
  albums: Album[];
  /** Whether the current user can modify this collection. */
  canEdit?: boolean;
  /** Whether the current user owns this collection (gates marketplace actions). */
  isOwner?: boolean;
  /** Label shown when viewing a collection shared by someone else. */
  collectionLabel?: string;
  /** Owner id new albums should be created under (the active collection). */
  ownerId?: string;
}

export function CatalogueClient({
  albums,
  canEdit = true,
  isOwner = true,
  collectionLabel,
  ownerId,
}: CatalogueClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // All filters initialize from URL so navigating back to /albums restores
  // the exact view the user left. Updates push back to the URL via
  // router.replace below.
  const [globalFilter, setGlobalFilter] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [conditionFilter, setConditionFilter] = useState<string>(
    () => searchParams.get("condition") ?? "all"
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    () => searchParams.get("status") ?? "all"
  );
  const [priceFilter, setPriceFilter] = useState<string>(
    () => searchParams.get("pricing") ?? "all"
  );
  const [duplicateFilter, setDuplicateFilter] = useState<string>(
    () => searchParams.get("dupes") ?? "all"
  );
  const [photoFilter, setPhotoFilter] = useState<string>(() => {
    // Back-compat: legacy ?missing=photos param continues to work; new
    // canonical param is ?photos=missing|with|all.
    if (searchParams.get("missing") === "photos") return "missing";
    return searchParams.get("photos") ?? "all";
  });
  const [sortBy, setSortBy] = useState<string>(
    () => searchParams.get("sort") ?? "default"
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState<null | "price" | "ai-price" | "list" | "delete">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const priceAllStartedRef = useRef(false);
  const marketplaceSyncStartedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setDrawerOpen(true);
    }
  }, [searchParams]);

  // Mirror current filter state into the URL via router.replace so:
  //   (a) clicking back to /albums from an album-detail restores the view
  //   (b) the URL is shareable/bookmarkable
  //   (c) action-only params (?add, ?action) aren't lost
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    const set = (key: string, value: string, defaultValue: string) => {
      if (value && value !== defaultValue) params.set(key, value);
      else params.delete(key);
    };

    set("q", globalFilter, "");
    set("condition", conditionFilter, "all");
    set("status", statusFilter, "all");
    set("pricing", priceFilter, "all");
    set("dupes", duplicateFilter, "all");
    set("photos", photoFilter, "all");
    set("sort", sortBy, "default");
    // Drop the legacy alias once the new param is in place.
    params.delete("missing");

    const next = params.toString();
    const current = searchParams.toString().replace(/&?missing=photos/, "");
    if (next === current) return;
    const url = next ? `${pathname}?${next}` : pathname;
    router.replace(url, { scroll: false });
  }, [
    globalFilter,
    conditionFilter,
    statusFilter,
    priceFilter,
    duplicateFilter,
    photoFilter,
    sortBy,
    pathname,
    router,
    searchParams,
  ]);

  // Reconcile catalogue with live eBay/Discogs state on load so delists
  // done outside VinylVault don't linger as "listed".
  useEffect(() => {
    if (!isOwner || marketplaceSyncStartedRef.current) return;
    const hasListings = albums.some(
      (a) => a.ebay_listing_id || a.discogs_listing_id
    );
    if (!hasListings) return;
    marketplaceSyncStartedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ebay/sync", { method: "POST" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data.changed > 0) {
          router.refresh();
        }
      } catch {
        // Background reconciliation should never interrupt catalogue browsing.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOwner, albums, router]);

  // Group albums by a normalized (artist|title) key so duplicates can be
  // surfaced. We pick the natural-language definition: same artist + same
  // title (case- and whitespace-insensitive). Catalog # is intentionally
  // ignored — repeated catalog numbers are how reissues are flagged, and
  // we don't want to hide them.
  const duplicateIds = useMemo(() => {
    const buckets = new Map<string, string[]>();
    for (const album of albums) {
      const key = `${album.artist.trim().toLowerCase()}|${album.title.trim().toLowerCase()}`;
      if (!key.includes("|") || key === "|") continue; // missing artist/title
      const list = buckets.get(key) ?? [];
      list.push(album.id);
      buckets.set(key, list);
    }
    const dupIds = new Set<string>();
    for (const list of buckets.values()) {
      if (list.length > 1) for (const id of list) dupIds.add(id);
    }
    return dupIds;
  }, [albums]);
  const duplicateCount = duplicateIds.size;

  const filteredData = useMemo(() => {
    const filtered = albums.filter((album) => {
      const matchesSearch =
        !globalFilter ||
        album.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
        album.artist.toLowerCase().includes(globalFilter.toLowerCase());
      const matchesCondition =
        conditionFilter === "all" || album.condition === conditionFilter;
      const matchesStatus =
        statusFilter === "all" || album.status === statusFilter;
      const hasPhotos =
        Array.isArray(album.photo_urls) && album.photo_urls.length > 0;
      const matchesPhotos =
        photoFilter === "all" ||
        (photoFilter === "with" && hasPhotos) ||
        (photoFilter === "missing" && !hasPhotos);
      const hasPrice =
        (album.list_price ?? album.suggested_price ?? 0) > 0;
      const matchesPrice =
        priceFilter === "all" ||
        (priceFilter === "priced" && hasPrice) ||
        (priceFilter === "unpriced" && !hasPrice);
      const isDuplicate = duplicateIds.has(album.id);
      const matchesDuplicate =
        duplicateFilter === "all" ||
        (duplicateFilter === "duplicates" && isDuplicate) ||
        (duplicateFilter === "uniques" && !isDuplicate);
      return (
        matchesSearch &&
        matchesCondition &&
        matchesStatus &&
        matchesPhotos &&
        matchesPrice &&
        matchesDuplicate
      );
    });

    if (sortBy === "price-desc" || sortBy === "price-asc") {
      const priceOf = (album: Album) =>
        album.list_price ?? album.suggested_price ?? 0;
      const dir = sortBy === "price-desc" ? -1 : 1;
      filtered.sort((a, b) => (priceOf(a) - priceOf(b)) * dir);
    } else if (duplicateFilter === "duplicates") {
      // When viewing duplicates, sort by artist/title so identical copies
      // sit next to each other for easy comparison and deletion.
      filtered.sort((a, b) => {
        const k = a.artist.trim().toLowerCase().localeCompare(b.artist.trim().toLowerCase());
        if (k !== 0) return k;
        return a.title.trim().toLowerCase().localeCompare(b.title.trim().toLowerCase());
      });
    }

    return filtered;
  }, [albums, globalFilter, conditionFilter, statusFilter, photoFilter, priceFilter, duplicateFilter, duplicateIds, sortBy]);

  const columns = useMemo<ColumnDef<Album>[]>(
    () => [
      ...(canEdit
        ? [
            {
              id: "select",
              header: ({ table }) => (
                <Checkbox
                  checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                  }
                  onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                  }
                />
              ),
              cell: ({ row }) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
                  onClick={(e) => e.stopPropagation()}
                />
              ),
              enableSorting: false,
            } as ColumnDef<Album>,
          ]
        : []),
      {
        id: "cover",
        header: "",
        cell: ({ row }) => {
          const cover = row.original.photo_urls?.[0];
          return cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={`${row.original.title} cover`}
              loading="lazy"
              className="h-11 w-11 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground">
              <Disc2 className="h-5 w-5" />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.artist}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "genre",
        header: "Genre",
        cell: ({ row }) =>
          row.original.genre ? (
            <Badge variant="secondary">{row.original.genre}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "condition",
        header: "Condition",
        cell: ({ row }) => (
          <ConditionBadge condition={row.original.condition} />
        ),
      },
      {
        accessorKey: "catalog_number",
        header: "Catalog #",
        cell: ({ row }) => row.original.catalog_number ?? "—",
      },
      {
        accessorKey: "suggested_price",
        header: "Suggested Price",
        cell: ({ row }) => (
          <span className="font-semibold text-accent">
            {formatCurrency(row.original.suggested_price)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <AlbumStatusBadge status={row.original.status} />
        ),
      },
    ],
    [canEdit]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });

  const selectedIds = table
    .getFilteredSelectedRowModel()
    .rows.map((r) => r.original.id);
  const selectedIdsKey = selectedIds.join("|");

  useEffect(() => {
    setConfirmDelete(false);
  }, [selectedIdsKey]);

  const handleBulkPrice = useCallback(async (ids = selectedIds) => {
    if (ids.length === 0) return;
    setBulkLoading("price");

    // The server caps each request at 3 albums so one slow Discogs match can't
    // run the whole batch into Vercel's 60s function limit.
    const CHUNK_SIZE = 3;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    toast.info(
      `Pricing ${ids.length} albums via Discogs${
        chunks.length > 1 ? ` (in ${chunks.length} batches)` : ""
      }...`
    );

    const allResults: Array<{
      status: "ok" | "cached" | "no_data" | "no_pricing" | "error";
      source?: string;
    }> = [];
    let failedBatches = 0;
    let firstBatchError: string | null = null;

    try {
      for (let i = 0; i < chunks.length; i++) {
        try {
          const res = await fetch("/api/pricing/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ albumIds: chunks[i] }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            failedBatches += 1;
            if (!firstBatchError) {
              firstBatchError = err.error ?? `Batch ${i + 1} failed (HTTP ${res.status})`;
            }
            // Keep going — a single bad batch (timeout, rate limit, bad row)
            // shouldn't abandon the rest of the selection.
            continue;
          }
          const { results } = (await res.json()) as { results: typeof allResults };
          allResults.push(...results);
        } catch (batchErr) {
          failedBatches += 1;
          if (!firstBatchError) {
            firstBatchError =
              batchErr instanceof Error ? batchErr.message : "Network error";
          }
        }
        if (chunks.length > 1) {
          toast.info(`Batch ${i + 1}/${chunks.length} done`, { duration: 1500 });
        }
      }

      const ok = allResults.filter((r) => r.status === "ok").length;
      const cached = allResults.filter((r) => r.status === "cached").length;
      const noData = allResults.filter((r) => r.status === "no_data").length;
      const noPricing = allResults.filter((r) => r.status === "no_pricing").length;
      const errors = allResults.filter((r) => r.status === "error").length;
      const ebayCount = allResults.filter(
        (r) => r.status === "ok" && r.source === "ebay-active"
      ).length;
      const accountedFor = ok + cached + noData + noPricing + errors;
      const trulySkipped = Math.max(0, ids.length - accountedFor);

      const parts: string[] = [];
      if (ok) {
        parts.push(
          ebayCount > 0
            ? `${ok} priced (${ebayCount} via eBay fallback)`
            : `${ok} priced`
        );
      }
      if (cached) parts.push(`${cached} cached`);
      if (noData) parts.push(`${noData} not found`);
      if (noPricing) parts.push(`${noPricing} found but no pricing data`);
      if (errors) parts.push(`${errors} failed`);
      if (trulySkipped > 0) parts.push(`${trulySkipped} not attempted`);

      if (failedBatches > 0) {
        const summary = parts.length > 0 ? parts.join(" · ") : "no albums priced";
        toast.error(
          `${failedBatches} of ${chunks.length} batches failed — ${summary}. ${firstBatchError ?? ""}`.trim(),
          { duration: 10000 }
        );
      } else if (parts.length > 0) {
        toast.success(parts.join(" · "));
      } else {
        toast.info("No albums needed pricing");
      }

      setRowSelection({});
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Pricing request failed. Try again in a moment."
      );
    } finally {
      setBulkLoading(null);
    }
  }, [selectedIds, router]);

  // AI bulk pricing — chunks the selection into 5-album batches because each
  // call hits Claude Sonnet (2–4s per album). Total ≤60s per request keeps
  // us under the Vercel function ceiling with headroom.
  const handleBulkAIPrice = useCallback(async (ids = selectedIds) => {
    if (ids.length === 0) return;

    // Rough cost guard so a stray click can't drop $20+ in one shot. Sonnet
    // at ~$0.004 per album → 100 albums ≈ $0.40. Confirm above 100.
    if (ids.length > 100) {
      const estimate = (ids.length * 0.004).toFixed(2);
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          `AI-price ${ids.length} albums? Estimated Claude API cost: ~$${estimate}. Continue?`
        )
      ) {
        return;
      }
    }

    setBulkLoading("ai-price");
    const CHUNK_SIZE = 5;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    toast.info(
      `AI-pricing ${ids.length} albums via Claude${
        chunks.length > 1 ? ` (in ${chunks.length} batches)` : ""
      }…`
    );

    const allResults: Array<{ status: "ok" | "skipped" | "error" }> = [];
    let failedBatches = 0;
    let firstBatchError: string | null = null;

    try {
      for (let i = 0; i < chunks.length; i++) {
        try {
          const res = await fetch("/api/pricing/ai-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ albumIds: chunks[i] }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            failedBatches += 1;
            if (!firstBatchError) {
              firstBatchError =
                err.error ?? `Batch ${i + 1} failed (HTTP ${res.status})`;
            }
            continue;
          }
          const { results } = (await res.json()) as {
            results: typeof allResults;
          };
          allResults.push(...results);
        } catch (batchErr) {
          failedBatches += 1;
          if (!firstBatchError) {
            firstBatchError =
              batchErr instanceof Error ? batchErr.message : "Network error";
          }
        }
        if (chunks.length > 1) {
          toast.info(`Batch ${i + 1}/${chunks.length} done`, { duration: 1500 });
        }
      }

      const ok = allResults.filter((r) => r.status === "ok").length;
      const skipped = allResults.filter((r) => r.status === "skipped").length;
      const errors = allResults.filter((r) => r.status === "error").length;
      const accountedFor = ok + skipped + errors;
      const trulySkipped = Math.max(0, ids.length - accountedFor);

      const parts: string[] = [];
      if (ok) parts.push(`${ok} AI-priced`);
      if (skipped) parts.push(`${skipped} skipped`);
      if (errors) parts.push(`${errors} failed`);
      if (trulySkipped > 0) parts.push(`${trulySkipped} not attempted`);

      if (failedBatches > 0) {
        const summary = parts.length > 0 ? parts.join(" · ") : "no albums priced";
        toast.error(
          `${failedBatches} of ${chunks.length} batches failed — ${summary}. ${firstBatchError ?? ""}`.trim(),
          { duration: 10000 }
        );
      } else if (parts.length > 0) {
        toast.success(parts.join(" · "));
      } else {
        toast.info("No albums AI-priced");
      }

      setRowSelection({});
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "AI pricing request failed. Try again in a moment."
      );
    } finally {
      setBulkLoading(null);
    }
  }, [selectedIds, router]);

  useEffect(() => {
    if (searchParams.get("action") !== "price-all") {
      priceAllStartedRef.current = false;
      return;
    }

    if (
      !canEdit ||
      priceAllStartedRef.current
    ) {
      return;
    }

    priceAllStartedRef.current = true;
    const idsToPrice = albums
      .filter((album) => {
        if (album.status === "sold") return false;
        const price = album.list_price ?? album.suggested_price;
        return price == null || price <= 0;
      })
      .map((album) => album.id);

    if (idsToPrice.length === 0) {
      toast.info("All unsold albums already have pricing.");
      router.replace("/albums");
      return;
    }

    void handleBulkPrice(idsToPrice).finally(() => router.replace("/albums"));
  }, [albums, canEdit, handleBulkPrice, router, searchParams]);

  const handleBulkDelete = useCallback(async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setConfirmDelete(false);
    setBulkLoading("delete");
    const res = await fetch("/api/albums/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumIds: selectedIds }),
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Deleted ${data.deleted} album${data.deleted !== 1 ? "s" : ""}`);
      setRowSelection({});
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Delete failed");
    }
    setBulkLoading(null);
  }, [selectedIds, confirmDelete, router]);

  const handleBulkList = useCallback(async () => {
    setBulkLoading("list");
    let listed = 0;
    let previewed = 0;
    let failed = 0;
    for (const id of selectedIds) {
      const res = await fetch("/api/ebay/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId: id }),
      });
      if (!res.ok) {
        failed += 1;
        continue;
      }
      const data = await res.json().catch(() => ({}));
      if (data.stub) previewed += 1;
      else listed += 1;
    }

    if (previewed > 0 && listed === 0) {
      toast.warning(
        `Preview only — eBay listing isn't wired up yet, so ${previewed} ${
          previewed === 1 ? "album was" : "albums were"
        } not posted.`,
        { duration: 10000 }
      );
    } else {
      const parts: string[] = [];
      if (listed > 0) parts.push(`${listed} listed`);
      if (previewed > 0) parts.push(`${previewed} preview-only`);
      if (failed > 0) parts.push(`${failed} failed`);
      toast.success(parts.join(" · "));
      router.refresh();
    }
    setBulkLoading(null);
  }, [selectedIds, router]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">Catalogue</h1>
          <Badge variant="secondary">{albums.length} albums</Badge>
          {collectionLabel && (
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {collectionLabel}
            </Badge>
          )}
          {!canEdit && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Eye className="h-3 w-3" />
              View only
            </Badge>
          )}
        </div>
        {canEdit && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Album
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search albums..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Condition</SelectItem>
            {(["Mint", "Great", "Good", "Fair", "Poor"] as AlbumCondition[]).map(
              (c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status</SelectItem>
            {(["unlisted", "pricing", "listed", "sold"] as AlbumStatus[]).map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Select value={photoFilter} onValueChange={setPhotoFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Photos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Photos</SelectItem>
            <SelectItem value="with">With photos</SelectItem>
            <SelectItem value="missing">Missing photos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priceFilter} onValueChange={setPriceFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Pricing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pricing</SelectItem>
            <SelectItem value="priced">Priced</SelectItem>
            <SelectItem value="unpriced">Not priced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={duplicateFilter} onValueChange={setDuplicateFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Duplicates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Duplicates
              {duplicateCount > 0 ? ` (${duplicateCount})` : ""}
            </SelectItem>
            <SelectItem value="duplicates">Only duplicates</SelectItem>
            <SelectItem value="uniques">Only uniques</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Sort: Default</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 animate-fade-in-up">
          <span className="text-sm">{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkPrice()}
            disabled={!!bulkLoading}
          >
            {bulkLoading === "price" ? (
              <>
                <VinylSpinner size="xs" />
                Pricing...
              </>
            ) : (
              "Auto-Price Selected"
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkAIPrice()}
            disabled={!!bulkLoading}
            title="Uses Claude AI for nuanced pricing. ~$0.004 per album (Sonnet)."
          >
            {bulkLoading === "ai-price" ? (
              <>
                <VinylSpinner size="xs" />
                AI pricing...
              </>
            ) : (
              "AI-Price Selected"
            )}
          </Button>
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkList}
              disabled={!!bulkLoading}
            >
              {bulkLoading === "list" ? (
                <>
                  <VinylSpinner size="xs" />
                  Listing...
                </>
              ) : (
                "List on eBay"
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => { if (!confirmDelete) { setConfirmDelete(true); } else { handleBulkDelete(); } }}
            disabled={bulkLoading === "delete"}
            className={confirmDelete ? "border-red-500/50 text-red-400 hover:bg-red-500/10" : "text-muted-foreground hover:text-red-400 hover:border-red-500/40 ml-auto"}
          >
            {bulkLoading === "delete" ? (
              <><VinylSpinner size="xs" /> Deleting...</>
            ) : confirmDelete ? (
              <><Trash2 className="h-3.5 w-3.5" /> Confirm delete {selectedIds.length}?</>
            ) : (
              <><Trash2 className="h-3.5 w-3.5" /> Delete</>
            )}
          </Button>
          {confirmDelete && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No albums found. Import your catalogue or add an album.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`cursor-pointer animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
                  onClick={() => router.push(`/albums/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canEdit && (
        <AddAlbumDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          ownerId={ownerId}
        />
      )}
    </div>
  );
}
