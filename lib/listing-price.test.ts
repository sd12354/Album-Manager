import { describe, expect, it } from "vitest";
import { resolveListingPrice } from "./listing-price";

describe("resolveListingPrice", () => {
  it("prefers the requested price, then album list price, then suggested price", () => {
    expect(resolveListingPrice(12, { list_price: 10, suggested_price: 8 })).toBe(12);
    expect(resolveListingPrice(undefined, { list_price: 10, suggested_price: 8 })).toBe(10);
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: 8 })).toBe(8);
  });

  it("rejects missing, zero, negative, and non-finite prices", () => {
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: null })).toBeNull();
    expect(resolveListingPrice(0, { list_price: 10, suggested_price: 8 })).toBeNull();
    expect(resolveListingPrice(-1, { list_price: 10, suggested_price: 8 })).toBeNull();
    expect(resolveListingPrice(Number.NaN, { list_price: 10, suggested_price: 8 })).toBeNull();
  });
});
