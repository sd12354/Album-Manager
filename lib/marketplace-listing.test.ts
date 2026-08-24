import { describe, expect, it } from "vitest";
import { resolveListingPrice } from "./marketplace-listing";

describe("resolveListingPrice", () => {
  it("prefers the requested price over stored prices", () => {
    expect(resolveListingPrice(12, 10, 8)).toBe(12);
  });

  it("falls back to list price and then suggested price", () => {
    expect(resolveListingPrice(undefined, 10, 8)).toBe(10);
    expect(resolveListingPrice(undefined, null, 8)).toBe(8);
  });

  it("rejects missing, zero, negative, and non-finite prices", () => {
    expect(resolveListingPrice(undefined, null, null)).toBeNull();
    expect(resolveListingPrice(0, null, 8)).toBeNull();
    expect(resolveListingPrice(-1, null, 8)).toBeNull();
    expect(resolveListingPrice(Number.NaN, null, 8)).toBeNull();
  });
});
