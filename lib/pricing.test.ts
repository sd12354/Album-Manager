import { describe, expect, it } from "vitest";
import { buildCombinedPricing, computeSuggestedPrice } from "./pricing";

describe("pricing helpers", () => {
  it("applies condition multipliers and minimum floor", () => {
    expect(computeSuggestedPrice(10, undefined, "Good")).toBe(7.5);
    expect(computeSuggestedPrice(2, undefined, "Poor")).toBe(3);
  });

  it("prefers Discogs condition pricing over eBay fallback", () => {
    const result = buildCombinedPricing(
      {
        releaseId: 123,
        releaseTitle: "Buzz Buzz Buzz",
        releaseYear: "1957",
        median: 10,
        lowest: 8,
        numForSale: 6,
        priceForCondition: 18,
        allConditionPrices: { "Very Good Plus (VG+)": 18 },
      },
      {
        median: 40,
        lowest: 35,
        highest: 50,
        count: 12,
        comparables: [35, 40, 50],
        sampleListings: [],
      },
      "Great"
    );

    expect(result.suggestedPrice).toBe(18);
    expect(result.suggestionSource).toBe("discogs-condition");
    expect(result.confidence).toBe("medium");
  });

  it("discounts active eBay listings when Discogs has no pricing", () => {
    const result = buildCombinedPricing(
      null,
      {
        median: 20,
        lowest: 15,
        highest: 30,
        count: 10,
        comparables: [15, 20, 30],
        sampleListings: [],
      },
      "Great"
    );

    expect(result.suggestedPrice).toBe(17);
    expect(result.suggestionSource).toBe("ebay-active");
    expect(result.confidence).toBe("high");
  });
});
