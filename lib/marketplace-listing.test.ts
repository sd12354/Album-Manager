import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("recognizes manual and stub listing IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("123456789")).toBe(false);
  });

  it("requires a real positive price instead of falling back to a default", () => {
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: null })).toBeNull();
    expect(resolveListingPrice(0, { list_price: 20, suggested_price: 30 })).toBeNull();
    expect(resolveListingPrice(undefined, { list_price: 20, suggested_price: 30 })).toBe(20);
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: 30 })).toBe(30);
  });
});
