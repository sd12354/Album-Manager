import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveMarketplaceListPrice,
} from "./marketplace-listing";
import type { Album } from "@/types";

const baseAlbum = {
  list_price: null,
  suggested_price: null,
} satisfies Pick<Album, "list_price" | "suggested_price">;

describe("resolveMarketplaceListPrice", () => {
  it("prefers a requested positive list price", () => {
    expect(resolveMarketplaceListPrice({ ...baseAlbum, list_price: 18 }, 22)).toBe(
      22
    );
  });

  it("falls back to stored list price, then suggested price", () => {
    expect(resolveMarketplaceListPrice({ ...baseAlbum, list_price: 18 })).toBe(18);
    expect(resolveMarketplaceListPrice({ ...baseAlbum, suggested_price: 15 })).toBe(
      15
    );
  });

  it("rejects missing, zero, and negative prices instead of inventing one", () => {
    expect(resolveMarketplaceListPrice(baseAlbum)).toBeNull();
    expect(resolveMarketplaceListPrice({ ...baseAlbum, list_price: 0 })).toBeNull();
    expect(resolveMarketplaceListPrice({ ...baseAlbum, suggested_price: -1 })).toBeNull();
  });
});

describe("isLocalMarketplaceListingId", () => {
  it("treats manual and stub listing IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
  });

  it("does not treat live marketplace IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("1234567890")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
