import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AlbumCondition } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface BoxRecord {
  num?: number;
  title?: string;
  artist?: string;
  genre?: string;
  condition?: string;
  goldmine_grade?: string;
  grade_range?: string;
  catalog?: string;
  price_low?: number;
  price_high?: number;
  down_low?: number;
  down_high?: number;
  confidence?: string;
  notes?: string;
  platform?: string;
  secondary_ref?: string;
  nm_upside?: number;
}

interface ImportFile {
  name: string;
  records: BoxRecord[];
}

// Map non-standard condition values that appear in the box files.
function mapCondition(
  raw: string,
  goldmineGrade: string
): AlbumCondition {
  const stdMap: Record<string, AlbumCondition> = {
    Mint: "Mint",
    Great: "Great",
    Good: "Good",
    Fair: "Fair",
    Poor: "Poor",
    "No Sleeve": "Fair",
    Broken: "Poor",
  };
  if (stdMap[raw]) return stdMap[raw];

  // Derive from Goldmine grade when condition is nonsensical (e.g. "Jazz")
  if (/NM|M-/i.test(goldmineGrade)) return "Great";
  if (/VG\+/i.test(goldmineGrade)) return "Great";
  if (/VG/i.test(goldmineGrade)) return "Good";
  if (/G\+/i.test(goldmineGrade)) return "Fair";
  if (/\bG\b/i.test(goldmineGrade)) return "Fair";
  return "Good";
}

function buildNotes(item: BoxRecord, conditionNote?: string): string {
  const parts: string[] = [];
  if (item.notes?.trim()) parts.push(item.notes.trim());

  const meta: string[] = [];
  if (item.goldmine_grade) meta.push(`Goldmine: ${item.goldmine_grade}`);
  if (item.grade_range && item.grade_range !== item.goldmine_grade) {
    meta.push(`Grade range: ${item.grade_range}`);
  }
  if (item.price_low != null && item.price_high != null && item.price_high > 0) {
    meta.push(`Est. $${item.price_low}–$${item.price_high}`);
  }
  if (item.nm_upside) meta.push(`NM upside: $${item.nm_upside}`);
  if (conditionNote) meta.push(conditionNote);

  if (meta.length > 0) parts.push(meta.join(" · "));
  return parts.join("\n");
}


export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { files: ImportFile[] };
  const { files } = body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const albumRows: object[] = [];
  const skipped: Array<{ file: string; num: number; reason: string }> = [];

  for (const file of files) {
    for (const record of file.records) {
      // Skip empty/blank records
      if (!record.title?.trim() || !record.artist?.trim()) {
        if (record.num) skipped.push({ file: file.name, num: record.num ?? 0, reason: "Empty record" });
        continue;
      }

      const rawCondition = record.condition?.trim() ?? "";
      const goldmine = record.goldmine_grade?.trim() ?? "";
      const condition = mapCondition(rawCondition, goldmine);

      const conditionNote =
        rawCondition === "No Sleeve"
          ? "No sleeve"
          : rawCondition === "Broken"
            ? "Damaged/broken"
            : !["Mint","Great","Good","Fair","Poor"].includes(rawCondition) && rawCondition
              ? `Original condition label: "${rawCondition}"`
              : undefined;

      const priceLow = record.price_low ?? 0;
      const priceHigh = record.price_high ?? 0;
      const suggestedPrice =
        priceLow > 0 && priceHigh > 0
          ? Math.round(((priceLow + priceHigh) / 2) * 100) / 100
          : priceHigh > 0
            ? priceHigh
            : null;

      albumRows.push({
        user_id: user.id,
        title: record.title.trim(),
        artist: record.artist.trim(),
        genre: record.genre?.trim() || null,
        condition,
        catalog_number: record.catalog?.trim() || null,
        notes: buildNotes(record, conditionNote) || null,
        suggested_price: suggestedPrice,
        status: suggestedPrice ? "pricing" : "unlisted",
        created_at: now,
        updated_at: now,
      });
    }
  }

  if (albumRows.length === 0) {
    return NextResponse.json({ error: "No valid records found in the provided files." }, { status: 400 });
  }

  // Insert albums in chunks
  const insertedAlbums: Array<{ id: string }> = [];
  const CHUNK = 100;
  for (let i = 0; i < albumRows.length; i += CHUNK) {
    const chunk = albumRows.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("albums").insert(chunk).select("id");
    if (error) {
      return NextResponse.json({ error: `Insert failed at chunk ${Math.floor(i / CHUNK) + 1}: ${error.message}` }, { status: 500 });
    }
    insertedAlbums.push(...(data ?? []));
  }

  // Populate pricing_cache for albums that have price data, so the pricing
  // card shows the box-analysis data without needing a fresh fetch.
  const cacheRows: object[] = [];
  let albumIdx = 0;

  for (const file of files) {
    for (const record of file.records) {
      if (!record.title?.trim() || !record.artist?.trim()) continue;
      const album = insertedAlbums[albumIdx++];
      if (!album) continue;

      const priceLow = record.price_low ?? 0;
      const priceHigh = record.price_high ?? 0;
      if (priceLow <= 0 && priceHigh <= 0) continue;

      const median = Math.round(((priceLow + priceHigh) / 2) * 100) / 100;
      const rawCondition = record.condition?.trim() ?? "";
      const goldmine = record.goldmine_grade?.trim() ?? "";
      const confidenceRaw = (record.confidence ?? "").toLowerCase() as
        | "high"
        | "medium"
        | "low"
        | "";
      const confidence = (["high", "medium", "low"].includes(confidenceRaw)
        ? confidenceRaw
        : "medium") as "high" | "medium" | "low";

      // Build allConditionPrices keyed by goldmine grade
      const allConditionPrices: Record<string, number> = {};
      if (goldmine && median > 0) allConditionPrices[goldmine] = median;

      cacheRows.push({
        album_id: album.id,
        source: "discogs",
        median_price: median,
        lowest_price: priceLow > 0 ? priceLow : null,
        num_sales: null,
        raw_data: {
          priceForCondition: median,
          allConditionPrices,
          confidence,
          matchedVia: `box-import (${file.name})`,
          goldmineGrade: goldmine || null,
          gradeRange: record.grade_range || null,
          nmUpside: record.nm_upside ?? null,
          platform: record.platform || null,
          conditionLabel: rawCondition || null,
        },
        fetched_at: now,
      });
    }
  }

  for (let i = 0; i < cacheRows.length; i += CHUNK) {
    const chunk = cacheRows.slice(i, i + CHUNK);
    await supabase.from("pricing_cache").insert(chunk);
    // Non-fatal — pricing cache is best-effort
  }

  return NextResponse.json({
    count: insertedAlbums.length,
    skipped: skipped.length,
    skippedDetails: skipped.slice(0, 20),
  });
}
