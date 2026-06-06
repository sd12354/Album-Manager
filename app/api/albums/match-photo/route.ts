import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifyAlbumFromCover } from "@/lib/ai-cover-identify";
import { findBestAlbumMatch } from "@/lib/album-matching";
import { ACCEPTED_MIME_TYPES } from "@/lib/photos";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    .eq("user_id", user.id)
    .order("title", { ascending: true });

  if (albumsError) {
    return NextResponse.json({ error: albumsError.message }, { status: 500 });
  }

  const matchResult = findBestAlbumMatch(
    identified,
    (albums ?? []) as Pick<Album, "id" | "artist" | "title" | "catalog_number">[]
  );

  console.log("[match-photo]", {
    event: "match_complete",
    fileName: file.name,
    identified,
    matchedAlbumId: matchResult.match?.albumId ?? null,
    score: matchResult.match?.score ?? null,
  });

  return NextResponse.json({
    fileName: file.name,
    identified,
    match: matchResult.match,
    alternatives: matchResult.alternatives,
    catalogueSize: albums?.length ?? 0,
  });
}
