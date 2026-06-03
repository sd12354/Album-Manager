import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { endEbayListing, getValidEbayToken, type EbayTokenCredentials } from "@/lib/ebay";
import { deleteDiscogsListing } from "@/lib/discogs";
import type { Album, UserSettings } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { albumIds } = await request.json() as { albumIds: string[] };
  if (!albumIds || albumIds.length === 0) {
    return NextResponse.json({ error: "albumIds required" }, { status: 400 });
  }

  const { data: albums } = await supabase
    .from("albums")
    .select("*")
    .in("id", albumIds)
    .eq("user_id", user.id);

  if (!albums || albums.length === 0) {
    return NextResponse.json({ error: "No albums found" }, { status: 404 });
  }

  const userMeta = (user.user_metadata ?? {}) as UserSettings;
  const discogsToken = userMeta.discogs_token || process.env.DISCOGS_PERSONAL_ACCESS_TOKEN;
  const ebayEnvironment = userMeta.ebay_environment ?? "stub";

  const { data: ebayCreds } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const isRealEbay = ebayEnvironment !== "stub" && ebayCreds?.access_token !== "stub-access-token";
  let ebayToken: string | null = null;

  if (isRealEbay && ebayCreds) {
    const tokenResult = await getValidEbayToken(ebayCreds as EbayTokenCredentials).catch(() => null);
    if (tokenResult) {
      ebayToken = tokenResult.token;
      if (tokenResult.refreshed) {
        await supabase.from("ebay_credentials").update({
          access_token: tokenResult.token,
          token_expiry: tokenResult.expiry,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);
      }
    }
  }

  // Remove active platform listings before deleting
  for (const album of albums as Album[]) {
    if (album.discogs_listing_id && discogsToken) {
      await deleteDiscogsListing(parseInt(album.discogs_listing_id, 10), discogsToken).catch(() => null);
    }
    if (album.ebay_listing_id && ebayToken && isRealEbay) {
      await endEbayListing(album.ebay_listing_id, ebayToken).catch(() => null);
    }
  }

  const { error } = await supabase
    .from("albums")
    .delete()
    .in("id", albumIds)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: albums.length });
}
