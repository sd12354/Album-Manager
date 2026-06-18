import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  endEbayListing,
  getValidEbayToken,
  hasRealEbayCredentials,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    albumId?: string;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { albumId } = body;
  if (!albumId) return NextResponse.json({ error: "albumId required" }, { status: 400 });

  const { data: album } = await supabase.from("albums").select("*").eq("id", albumId).single();
  if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

  if ((album as Album).user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the collection owner can manage marketplace listings." },
      { status: 403 }
    );
  }

  const typedAlbum = album as Album;
  if (typedAlbum.status === "sold") {
    return NextResponse.json(
      { error: "Sold albums cannot be delisted." },
      { status: 409 }
    );
  }

  if (!typedAlbum.ebay_listing_id) {
    return NextResponse.json({ error: "Album is not listed on eBay" }, { status: 400 });
  }

  const { data: ebayCreds } = await supabase.from("ebay_credentials").select("*").eq("user_id", user.id).maybeSingle();

  const isRealEbay = hasRealEbayCredentials(ebayCreds);
  const isManualListing = typedAlbum.ebay_listing_id.startsWith("manual-");

  if (isRealEbay && ebayCreds && !isManualListing) {
    const tokenResult = await getValidEbayToken(ebayCreds as EbayTokenCredentials);
    if (tokenResult.refreshed) {
      await supabase.from("ebay_credentials").update({
        access_token: tokenResult.token,
        token_expiry: tokenResult.expiry,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    }
    await endEbayListing(typedAlbum.ebay_listing_id, tokenResult.token);
  }

  // Determine new status — if still listed on Discogs, keep as listed
  const newStatus = typedAlbum.discogs_listing_id ? "listed" : "unlisted";

  await supabase.from("albums").update({
    ebay_listing_id: null,
    ebay_listing_url: null,
    status: newStatus,
  }).eq("id", albumId);

  return NextResponse.json({ ok: true, stub: !isRealEbay });
}
