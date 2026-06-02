"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Plus, Search } from "lucide-react";
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
}

export function CatalogueClient({ albums }: CatalogueClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState<null | "price" | "list">(null);

  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setDrawerOpen(true);
    }
  }, [searchParams]);

  const filteredData = useMemo(() => {
    return albums.filter((album) => {
      const matchesSearch =
        !globalFilter ||
        album.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
        album.artist.toLowerCase().includes(globalFilter.toLowerCase());
      const matchesCondition =
        conditionFilter === "all" || album.condition === conditionFilter;
      const matchesStatus =
        statusFilter === "all" || album.status === statusFilter;
      return matchesSearch && matchesCondition && matchesStatus;
    });
  }, [albums, globalFilter, conditionFilter, statusFilter]);

  const columns = useMemo<ColumnDef<Album>[]>(
    () => [
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
    []
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

  const handleBulkPrice = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading("price");

    // Server caps each request at 15 albums to fit within Vercel's 60s
    // serverless function limit. Chunk the selection client-side so users
    // can price arbitrarily large selections without thinking about it.
    const CHUNK_SIZE = 15;
    const chunks: string[][] = [];
    for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
      chunks.push(selectedIds.slice(i, i + CHUNK_SIZE));
    }

    toast.info(
      `Pricing ${selectedIds.length} albums via Discogs${
        chunks.length > 1 ? ` (in ${chunks.length} batches)` : ""
      }...`
    );

    const allResults: Array<{
      status: "ok" | "cached" | "no_data" | "error";
      source?: string;
    }> = [];
    let failed = false;

    for (let i = 0; i < chunks.length; i++) {
      const res = await fetch("/api/pricing/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumIds: chunks[i] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? `Batch ${i + 1} failed`);
        failed = true;
        break;
      }
      const { results } = (await res.json()) as { results: typeof allResults };
      allResults.push(...results);
      if (chunks.length > 1) {
        toast.info(`Batch ${i + 1}/${chunks.length} done`);
      }
    }

    if (!failed) {
      const ok = allResults.filter((r) => r.status === "ok").length;
      const cached = allResults.filter((r) => r.status === "cached").length;
      const noData = allResults.filter((r) => r.status === "no_data").length;
      const errors = allResults.filter((r) => r.status === "error").length;
      const ebayCount = allResults.filter(
        (r) => r.status === "ok" && r.source === "ebay-active"
      ).length;
      const parts: string[] = [];
      if (ok) {
        parts.push(
          ebayCount > 0
            ? `${ok} priced (${ebayCount} via eBay fallback)`
            : `${ok} priced`
        );
      }
      if (cached) parts.push(`${cached} cached`);
      if (noData) parts.push(`${noData} no match`);
      if (errors) parts.push(`${errors} failed`);
      toast.success(parts.join(" · "));
      router.refresh();
    }
    setBulkLoading(null);
  }, [selectedIds, router]);

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
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold">Catalogue</h1>
          <Badge variant="secondary">{albums.length} albums</Badge>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Album
        </Button>
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
      </div>

      {selectedIds.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 animate-fade-in-up">
          <span className="text-sm">{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkPrice}
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
        </div>
      )}

      <div className="mt-6 rounded-xl border border-white/8">
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

      <AddAlbumDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
