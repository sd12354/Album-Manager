import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkEbayItemSold,
  endEbayListing,
  getEbayOrderForItem,
  getValidEbayToken,
  type EbayBuyerAddress,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import {
  deleteDiscogsListing,
  getDiscogsListingStatus,
  getDiscogsOrderForListing,
  parseDiscogsShippingAddress,
  resolveDiscogsAuth,
} from "@/lib/discogs";
import {
  createShippingLabel,
  resolveShippoAuth,
  type ShippoAddress,
} from "@/lib/shippo";
import type { Album, UserSettings } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 45;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { albumId } = await request.json();
  if (!albumId) {
    return NextResponse.json({ error: "albumId required" }, { status: 400 });
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
      { error: "Only the collection owner can sync marketplace sales." },
      { status: 403 }
    );
  }

  const typedAlbum = album as Album;

  if (typedAlbum.status === "sold") {
    return NextResponse.json({ status: "sold", changed: false });
  }

  const userMeta = (user.user_metadata ?? {}) as UserSettings;
  const discogsAuth = resolveDiscogsAuth(user.user_metadata);

  const { data: ebayCreds } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const ebayEnvironment = userMeta.ebay_environment ?? "stub";
  const isRealEbay =
    ebayEnvironment !== "stub" &&
    ebayCreds?.access_token !== "stub-access-token";

  let soldOn: "ebay" | "discogs" | null = null;
  let soldPrice: number | undefined;
  let buyerAddress: EbayBuyerAddress | null = null;
  let buyerAddressRaw: string | null = null;
  let ebayToken: string | null = null;

  // ── Check eBay ──────────────────────────────────────────────────────────────
  if (typedAlbum.ebay_listing_id && ebayCreds && isRealEbay) {
    try {
      const tokenResult = await getValidEbayToken(
        ebayCreds as EbayTokenCredentials
      );
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
      ebayToken = tokenResult.token;

      const { sold, price } = await checkEbayItemSold(
        typedAlbum.ebay_listing_id,
        tokenResult.token
      );

      if (sold) {
        soldOn = "ebay";
        soldPrice = price ?? typedAlbum.list_price ?? undefined;

        // Fetch buyer address from GetOrders
        buyerAddress = await getEbayOrderForItem(
          typedAlbum.ebay_listing_id,
          tokenResult.token
        ).catch(() => null);
      }
    } catch {
      // Non-fatal — continue to check Discogs
    }
  }

  // ── Check Discogs ────────────────────────────────────────────────────────────
  if (!soldOn && typedAlbum.discogs_listing_id && discogsAuth) {
    try {
      const result = await getDiscogsListingStatus(
        parseInt(typedAlbum.discogs_listing_id, 10),
        discogsAuth
      );

      if (result?.status === "Sold") {
        soldOn = "discogs";
        soldPrice = result.price ?? typedAlbum.list_price ?? undefined;

        // Fetch buyer address from Discogs order
        const order = await getDiscogsOrderForListing(
          parseInt(typedAlbum.discogs_listing_id, 10),
          discogsAuth
        ).catch(() => null);

        if (order?.shippingAddress) {
          buyerAddressRaw = order.shippingAddress;
          const parsed = parseDiscogsShippingAddress(
            order.shippingAddress,
            order.buyerName
          );
          if (parsed) {
            buyerAddress = parsed;
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  if (!soldOn) {
    return NextResponse.json({ status: typedAlbum.status, changed: false });
  }

  // ── Mark sold ────────────────────────────────────────────────────────────────
  await supabase
    .from("albums")
    .update({
      status: "sold",
      sold_price: soldPrice ?? null,
      sold_at: new Date().toISOString(),
      buyer_name: buyerAddress?.name ?? null,
      buyer_address_raw:
        buyerAddressRaw ??
        (buyerAddress ? formatAddress(buyerAddress) : null),
    })
    .eq("id", albumId);

  // ── Cross-cancel other platform ───────────────────────────────────────────────
  if (soldOn === "ebay" && typedAlbum.discogs_listing_id && discogsAuth) {
    await deleteDiscogsListing(
      parseInt(typedAlbum.discogs_listing_id, 10),
      discogsAuth
    ).catch(() => null);
  }

  if (soldOn === "discogs" && typedAlbum.ebay_listing_id && ebayCreds && isRealEbay && ebayToken) {
    await endEbayListing(typedAlbum.ebay_listing_id, ebayToken).catch(() => null);
  }

  // ── Auto-create shipping label ────────────────────────────────────────────────
  let label: { trackingNumber: string; labelUrl: string; carrier: string; serviceLevel: string; rate: number } | null = null;
  let labelError: string | null = null;

  const shippoEnabled = userMeta.shippo_enabled ?? false;
  const shippoAuth = resolveShippoAuth(userMeta);
  const sellerReady =
    userMeta.seller_name && userMeta.seller_street1 && userMeta.seller_city;

  if (shippoEnabled && shippoAuth && sellerReady && buyerAddress) {
    const from: ShippoAddress = {
      name: userMeta.seller_name!,
      street1: userMeta.seller_street1!,
      street2: userMeta.seller_street2,
      city: userMeta.seller_city!,
      state: userMeta.seller_state ?? "",
      zip: userMeta.seller_zip ?? "",
      country: userMeta.seller_country ?? "US",
    };

    try {
      label = await createShippingLabel({
        from,
        to: buyerAddress,
        auth: shippoAuth,
      });

      await supabase
        .from("albums")
        .update({
          tracking_number: label.trackingNumber,
          shipping_label_url: label.labelUrl,
          shipping_carrier: `${label.carrier} — ${label.serviceLevel}`,
          shipping_rate: label.rate,
        })
        .eq("id", albumId);
    } catch (err) {
      labelError =
        err instanceof Error ? err.message : "Label creation failed";
    }
  } else if (shippoEnabled && shippoAuth && sellerReady && !buyerAddress) {
    labelError = "Buyer address unavailable — create the label manually from the album page.";
  } else if (shippoEnabled && shippoAuth && !sellerReady) {
    labelError = "Seller address incomplete — fill it in Settings → Shipping.";
  } else if (shippoEnabled && !shippoAuth) {
    labelError = "Shippo isn't connected — connect it in Settings → Shipping.";
  }
  // If shippoEnabled is false, labelError stays null — silent, no nagging.

  return NextResponse.json({
    status: "sold",
    soldOn,
    soldPrice,
    changed: true,
    label,
    labelError,
    buyerAddressRaw,
  });
}

function formatAddress(a: {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}): string {
  return [a.name, a.street1, a.street2, `${a.city}, ${a.state} ${a.zip}`, a.country]
    .filter(Boolean)
    .join("\n");
}
