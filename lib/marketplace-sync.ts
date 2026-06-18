import {
  endEbayListing,
  getEbayListingState,
  getEbayOrderForItem,
  getValidEbayToken,
  hasRealEbayCredentials,
  type EbayBuyerAddress,
  type EbayTokenCredentials,
} from "@/lib/ebay";
import {
  deleteDiscogsListing,
  getDiscogsListingState,
  getDiscogsOrderForListing,
  parseDiscogsShippingAddress,
  resolveUserDiscogsAuth,
  type DiscogsAuth,
} from "@/lib/discogs";
import type { Album, AlbumStatus } from "@/types";

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

export interface MarketplaceSyncOutcome {
  soldOn: "ebay" | "discogs" | null;
  soldPrice?: number;
  delistedFrom: Array<"ebay" | "discogs">;
  buyerAddress: EbayBuyerAddress | null;
  buyerAddressRaw: string | null;
  changed: boolean;
  status: AlbumStatus;
  /** Partial album row to persist when changed is true. */
  updates: Partial<Album>;
}

function deriveListedStatus(
  hasEbay: boolean,
  hasDiscogs: boolean
): AlbumStatus {
  if (hasEbay || hasDiscogs) return "listed";
  return "unlisted";
}

export interface MarketplaceSyncContext {
  album: Album;
  discogsAuth: DiscogsAuth | null;
  ebayCreds: EbayTokenCredentials | null;
  isRealEbay: boolean;
}

/**
 * Compares stored listing IDs against live eBay/Discogs state. Detects sales
 * and listings removed directly on the marketplace (ended, deleted, expired).
 */
export async function checkAlbumMarketplaceState(
  ctx: MarketplaceSyncContext
): Promise<MarketplaceSyncOutcome> {
  const { album } = ctx;
  let hasEbay = Boolean(album.ebay_listing_id);
  let hasDiscogs = Boolean(album.discogs_listing_id);
  const delistedFrom: Array<"ebay" | "discogs"> = [];

  let soldOn: "ebay" | "discogs" | null = null;
  let soldPrice: number | undefined;
  let buyerAddress: EbayBuyerAddress | null = null;
  let buyerAddressRaw: string | null = null;
  let ebayToken: string | null = null;

  const ebayIsManual = album.ebay_listing_id?.startsWith("manual-") ?? false;
  const discogsIsManual = album.discogs_listing_id?.startsWith("manual-") ?? false;

  if (album.ebay_listing_id && !ebayIsManual && ctx.ebayCreds && ctx.isRealEbay) {
    try {
      const tokenResult = await getValidEbayToken(ctx.ebayCreds);
      ebayToken = tokenResult.token;

      const ebayState = await getEbayListingState(
        album.ebay_listing_id,
        tokenResult.token
      );

      if (ebayState.state === "sold") {
        soldOn = "ebay";
        soldPrice = ebayState.price ?? album.list_price ?? undefined;
        buyerAddress = await getEbayOrderForItem(
          album.ebay_listing_id,
          tokenResult.token
        ).catch(() => null);
      } else if (
        ebayState.state === "ended" ||
        ebayState.state === "not_found"
      ) {
        hasEbay = false;
        delistedFrom.push("ebay");
      }
    } catch {
      // Non-fatal — keep stored state if the API is temporarily unavailable.
    }
  }

  if (!soldOn && album.discogs_listing_id && !discogsIsManual && ctx.discogsAuth) {
    try {
      const discogsState = await getDiscogsListingState(
        parseInt(album.discogs_listing_id, 10),
        ctx.discogsAuth
      );

      if (discogsState.state === "sold") {
        soldOn = "discogs";
        soldPrice = discogsState.price ?? album.list_price ?? undefined;

        const order = await getDiscogsOrderForListing(
          parseInt(album.discogs_listing_id, 10),
          ctx.discogsAuth
        ).catch(() => null);

        if (order?.shippingAddress) {
          buyerAddressRaw = order.shippingAddress;
          const parsed = parseDiscogsShippingAddress(
            order.shippingAddress,
            order.buyerName
          );
          if (parsed) buyerAddress = parsed;
        }
      } else if (
        discogsState.state === "inactive" ||
        discogsState.state === "not_found"
      ) {
        hasDiscogs = false;
        delistedFrom.push("discogs");
      }
    } catch {
      // Non-fatal
    }
  }

  if (soldOn) {
    const updates: Partial<Album> = {
      status: "sold",
      sold_price: soldPrice ?? null,
      sold_at: new Date().toISOString(),
      buyer_name: buyerAddress?.name ?? null,
      buyer_address_raw:
        buyerAddressRaw ??
        (buyerAddress ? formatAddress(buyerAddress) : null),
      ebay_listing_id: null,
      ebay_listing_url: null,
      discogs_listing_id: null,
      discogs_listing_url: null,
    };

    return {
      soldOn,
      soldPrice,
      delistedFrom,
      buyerAddress,
      buyerAddressRaw,
      changed: true,
      status: "sold",
      updates,
    };
  }

  if (delistedFrom.length === 0) {
    return {
      soldOn: null,
      delistedFrom,
      buyerAddress: null,
      buyerAddressRaw: null,
      changed: false,
      status: album.status,
      updates: {},
    };
  }

  const updates: Partial<Album> = {
    status: deriveListedStatus(hasEbay, hasDiscogs),
  };

  if (delistedFrom.includes("ebay")) {
    updates.ebay_listing_id = null;
    updates.ebay_listing_url = null;
  }
  if (delistedFrom.includes("discogs")) {
    updates.discogs_listing_id = null;
    updates.discogs_listing_url = null;
  }

  return {
    soldOn: null,
    delistedFrom,
    buyerAddress: null,
    buyerAddressRaw: null,
    changed: true,
    status: updates.status as AlbumStatus,
    updates,
  };
}

/** Cross-cancel the other marketplace after a sale. */
export async function crossCancelOtherMarketplace(
  album: Album,
  soldOn: "ebay" | "discogs",
  discogsAuth: DiscogsAuth | null,
  ebayToken: string | null,
  isRealEbay: boolean
): Promise<void> {
  const ebayIsManual = album.ebay_listing_id?.startsWith("manual-") ?? false;
  const discogsIsManual = album.discogs_listing_id?.startsWith("manual-") ?? false;

  if (
    soldOn === "ebay" &&
    album.discogs_listing_id &&
    !discogsIsManual &&
    discogsAuth
  ) {
    await deleteDiscogsListing(
      parseInt(album.discogs_listing_id, 10),
      discogsAuth
    ).catch(() => null);
  }

  if (
    soldOn === "discogs" &&
    album.ebay_listing_id &&
    !ebayIsManual &&
    ebayToken &&
    isRealEbay
  ) {
    await endEbayListing(album.ebay_listing_id, ebayToken).catch(() => null);
  }
}

export function buildMarketplaceSyncContext(
  album: Album,
  userMetadata: Record<string, unknown> | undefined,
  ebayCreds: { access_token?: string | null } | null
): MarketplaceSyncContext {
  return {
    album,
    discogsAuth: resolveUserDiscogsAuth(userMetadata),
    ebayCreds: ebayCreds as EbayTokenCredentials | null,
    isRealEbay: hasRealEbayCredentials(ebayCreds),
  };
}
