import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/collections";
import { identifyAlbumFromCover } from "@/lib/ai-cover-identify";
import { pickMatchingRelease } from "@/lib/ai-cover-compare";
import {
  findBestAlbumMatch,
  findBestAlbumMatchMulti,
  type ScoredIdentification,
} from "@/lib/album-matching";
import {
  resolveDiscogsAuth,
  searchDiscogsCandidates,
} from "@/lib/discogs";
import { ACCEPTED_MIME_TYPES } from "@/lib/photos";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const ctx = await getActiveContext();

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ctx.canEdit) {
    return NextResponse.json(
      { error: "You have view-only access to this collection." },
      { status: 403 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured. Add it in your environment to enable cover photo matching.",
      },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported image type${file.type ? ` (${file.type})` : ""}. Use JPEG, PNG, or WebP.`,
      },
      { status: 400 }
    );
  }

  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: "Image must be under 15MB for cover matching." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let identified;
  try {
    identified = await identifyAlbumFromCover(buffer, file.type);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not read cover photo";
    console.error("[match-photo]", { event: "identify_failed", message });
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { data: albums, error: albumsError } = await supabase
    .from("albums")
    .select("id, artist, title, catalog_number")
    .eq("user_id", ctx.ownerId)
    .order("title", { ascending: true });

  if (albumsError) {
    return NextResponse.json({ error: albumsError.message }, { status: 500 });
  }

  const catalogue = (albums ?? []) as Pick<
    Album,
    "id" | "artist" | "title" | "catalog_number"
  >[];

  // Fast path: match the OCR reading against the catalogue first.
  let matchResult = findBestAlbumMatch(identified, catalogue);
  let confirmedVia: "discogs-cover" | null = null;
  let discogsIdentified: typeof identified | null = null;

  // When the text reading didn't yield a confident match — often because the
  // cover uses stylized fonts the OCR pass can't read — fall back to comparing
  // the actual artwork against Discogs release covers, then match using
  // Discogs's clean, authoritative artist/title.
  const needsVisualHelp = !matchResult.match || matchResult.match.confidence !== "high";

  if (needsVisualHelp && catalogue.length > 0) {
    const discogsAuth = resolveDiscogsAuth(ctx.user.user_metadata);
    if (discogsAuth) {
      try {
        const candidates = await searchDiscogsCandidates(
          identified.artist,
          identified.title,
          identified.catalogNumber ?? undefined,
          discogsAuth,
          4
        );

        if (candidates.length > 0) {
          const visual = await pickMatchingRelease(buffer, file.type, candidates);
          if (visual.index >= 0) {
            const chosen = candidates[visual.index];
            discogsIdentified = {
              artist: chosen.artist,
              title: chosen.title,
              catalogNumber: chosen.catalogNumber ?? null,
              label: null,
            };
            const strong = visual.confidence === "high" || visual.confidence === "medium";

            const identifications: ScoredIdentification[] = [
              { identified },
              { identified: discogsIdentified, bonus: strong ? 0.12 : 0.04 },
            ];
            const combined = findBestAlbumMatchMulti(identifications, catalogue);

            // Keep whichever pass produced the stronger match.
            if ((combined.match?.score ?? 0) >= (matchResult.match?.score ?? 0)) {
              matchResult = combined;
              if (combined.match) confirmedVia = "discogs-cover";
            }
          }
        }
      } catch (err) {
        console.warn("[match-photo]", {
          event: "discogs_visual_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  console.log("[match-photo]", {
    event: "match_complete",
    fileName: file.name,
    identified,
    confirmedVia,
    matchedAlbumId: matchResult.match?.albumId ?? null,
    score: matchResult.match?.score ?? null,
  });

  return NextResponse.json({
    fileName: file.name,
    identified,
    discogsIdentified,
    confirmedVia,
    match: matchResult.match,
    alternatives: matchResult.alternatives,
    catalogueSize: catalogue.length,
  });
}
