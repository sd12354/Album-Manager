import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createEbayListing,
  getValidEbayToken,
  hasRealEbayCredentials,
  type EbayTokenCredentials,
  type SellerLocation,
} from "@/lib/ebay";
import { generateListingDescription } from "@/lib/ai-pricing";
import { resolveMarketplaceListPrice } from "@/lib/marketplace-listing";
import type { Album, AlbumCondition, UserSettings } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    albumId?: string;
    listPrice?: number;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { albumId, listPrice } = body;
  if (!albumId) {
    return NextResponse.json({ error: "albumId required" }, { status: 400 });
  }

  const { data: creds } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!creds) {
    return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });
  }

  const { data: album, error } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .single();

  if (error || !album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  if ((album as Album).user_id !== user.id) {
    return NextResponse.json(
      {
        error:
          "Only the collection owner can list to marketplaces. Ask them to connect their eBay account and list this album.",
      },
      { status: 403 }
    );
  }

  const typedAlbum = album as Album;
  if (typedAlbum.status === "sold") {
    return NextResponse.json(
      { error: "Sold albums cannot be listed." },
      { status: 409 }
    );
  }

  if (typedAlbum.ebay_listing_id) {
    return NextResponse.json(
      { error: "Album is already listed on eBay" },
      { status: 409 }
    );
  }

  const price = resolveMarketplaceListPrice(
    listPrice,
    typedAlbum.list_price,
    typedAlbum.suggested_price
  );
  if (price === null) {
    return NextResponse.json(
      { error: "Set a positive list price before listing this album." },
      { status: 400 }
    );
  }

  // Stub only when OAuth was never configured or the stored token is the dev
  // placeholder — NOT from user_metadata.ebay_environment, which can be stale
  // or missing even after a real production connect.
  const isStub = !hasRealEbayCredentials(creds);

  if (isStub) {
    const fakeItemId = `STUB-${Date.now()}`;
    const { error: updateError } = await supabase
      .from("albums")
      .update({
        status: "listed",
        ebay_listing_id: fakeItemId,
        ebay_listing_url: `https://sandbox.ebay.com/itm/${fakeItemId}`,
        list_price: price,
      })
      .eq("id", albumId);

    if (updateError) {
      console.error("[ebay]", {
        scope: "ebay",
        event: "stub_list_persist_failed",
        albumId,
        message: updateError.message,
      });
      return NextResponse.json(
        { error: "Stub listing could not be saved. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      stub: true,
      listingId: fakeItemId,
      listingUrl: `https://sandbox.ebay.com/itm/${fakeItemId}`,
      message: "Stub listing created — connect a real eBay sandbox/production account to post live listings.",
    });
  }

  // Real listing via Trading API.
  const tokenResult = await getValidEbayToken(creds as EbayTokenCredentials);

  if (tokenResult.refreshed) {
    await supabase
      .from("ebay_credentials")
      .update({
        access_token: tokenResult.token,
        token_expiry: tokenResult.expiry,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  // Pull seller location from user settings so eBay gets a valid <Location>.
  const userMeta = (user.user_metadata ?? {}) as UserSettings;
  const sellerLocation: SellerLocation = {
    city: userMeta.seller_city,
    state: userMeta.seller_state,
    zip: userMeta.seller_zip,
    country: userMeta.seller_country || "US",
  };

  // Use stored AI description if available, otherwise try to generate one,
  // fall back to the rule-based description if AI isn't configured.
  let aiDescription: string | undefined;
  if (typedAlbum.listing_description) {
    aiDescription = typedAlbum.listing_description;
  } else if (process.env.ANTHROPIC_API_KEY) {
    try {
      aiDescription = await generateListingDescription({
        artist: typedAlbum.artist,
        title: typedAlbum.title,
        genre: typedAlbum.genre,
        condition: typedAlbum.condition as AlbumCondition,
        catalogNumber: typedAlbum.catalog_number,
        notes: typedAlbum.notes,
        suggestedPrice: price,
        platform: "ebay",
      });
      // Persist for future use
      await supabase
        .from("albums")
        .update({ listing_description: aiDescription })
        .eq("id", albumId);
    } catch {
      // Non-fatal — fall back to rule-based description
    }
  }

  try {
    const { itemId, listingUrl } = await createEbayListing(
      typedAlbum,
      price,
      tokenResult.token,
      sellerLocation,
      aiDescription
    );

    const { error: updateError } = await supabase
      .from("albums")
      .update({
        status: "listed",
        ebay_listing_id: itemId,
        ebay_listing_url: listingUrl,
        list_price: price,
      })
      .eq("id", albumId);

    if (updateError) {
      console.error("[ebay]", {
        scope: "ebay",
        event: "list_persist_failed",
        albumId,
        itemId,
        message: updateError.message,
      });
      return NextResponse.json(
        {
          error:
            "eBay listing was created, but VinylVault could not save the listing state. Avoid retrying until the listing is reconciled.",
          listingId: itemId,
          listingUrl,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ listingId: itemId, listingUrl });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "eBay listing failed";

    // Map well-known eBay API errors to actionable guidance.
    let message = raw;
    if (
      /seller.{0,30}account/i.test(raw) ||
      /additional information/i.test(raw) ||
      /seller registration/i.test(raw) ||
      /complete your seller/i.test(raw)
    ) {
      message =
        "Your eBay seller account isn't fully set up yet. " +
        "Visit ebay.com/sell/setup to complete seller registration " +
        "(identity verification + payout method), then try again.";
    } else if (
      /business polic/i.test(raw) ||
      /SellerProfile/i.test(raw) ||
      /shipping profile/i.test(raw) ||
      /return policy profile/i.test(raw) ||
      /payment profile/i.test(raw)
    ) {
      message =
        "eBay requires at least one Shipping, Returns, and Payment business policy. " +
        "Set them up at ebay.com/sel/adm/biz-policy/manage, then try again.";
    } else if (/location/i.test(raw) || /postal code/i.test(raw)) {
      message =
        "Item location is missing. Fill in your seller address in Settings → Shipping, then try again.";
    } else if (/managed payment/i.test(raw) || /payments program/i.test(raw)) {
      message =
        "eBay Managed Payments isn't enabled on your account. " +
        "Enrol at ebay.com/sell/setup to continue.";
    } else if (/condition id/i.test(raw) || /condition is invalid/i.test(raw)) {
      message =
        "eBay rejected the item condition for this category. " +
        "Try updating the album condition and listing again.";
    } else if (/item specific/i.test(raw) && /missing/i.test(raw)) {
      message =
        "eBay requires additional item details for this listing. " +
        "Ensure artist, title, and genre are filled in on the album, then try again.";
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
