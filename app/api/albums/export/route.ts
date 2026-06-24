import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/collections";
import { fetchAllPages } from "@/lib/paginate";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CSV_COLUMNS: Array<keyof Album> = [
  "title",
  "artist",
  "genre",
  "condition",
  "catalog_number",
  "notes",
  "purchase_price",
  "suggested_price",
  "list_price",
  "sold_price",
  "sold_at",
  "status",
  "ebay_listing_url",
  "discogs_listing_url",
  "listing_description",
  "photo_urls",
  "created_at",
  "updated_at",
];

/** Escape a single CSV cell per RFC 4180. */
function csvEscape(value: unknown): string {
  if (value == null) return "";
  let s: string;
  if (Array.isArray(value)) {
    // Photo URLs etc. — join with pipe so the cell stays a single field.
    s = value.join(" | ");
  } else if (typeof value === "object") {
    s = JSON.stringify(value);
  } else {
    s = String(value);
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(albums: Album[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = albums.map((a) =>
    CSV_COLUMNS.map((col) => csvEscape(a[col])).join(",")
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}

export async function GET(request: Request) {
  const ctx = await getActiveContext();
  if (!ctx) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "json") {
    return new Response("format must be 'csv' or 'json'", { status: 400 });
  }

  const supabase = await createClient();

  let albums: Album[];
  try {
    albums = await fetchAllPages<Album>((from, to) =>
      supabase
        .from("albums")
        .select("*")
        .eq("user_id", ctx.ownerId)
        .order("artist", { ascending: true })
        .range(from, to)
    );
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Failed to load catalogue",
      { status: 500 }
    );
  }

  // Drop internal-only columns from the exported records.
  const sanitized = albums.map((a) => {
    const { user_id: _userId, id: _id, ...rest } = a as Album & {
      user_id?: string;
    };
    void _userId;
    void _id;
    return rest;
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `vinylvault-${date}.${format}`;

  if (format === "json") {
    return new Response(JSON.stringify(sanitized, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // CSV path. Cast back to Album so the CSV columns can index typed keys.
  const body = toCsv(sanitized as unknown as Album[]);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
