import { describe, expect, it } from "vitest";
import { deriveRows } from "./csv";

describe("CSV album import helpers", () => {
  it("reports row 1 for invalid headerless CSV data", () => {
    const result = deriveRows(
      [
        {
          "Column 1": "Missing Artist",
          "Column 2": "",
          "Column 3": "Rock",
          "Column 4": "Great",
          "Column 5": "ABC-1",
        },
      ],
      {
        "Column 1": "title",
        "Column 2": "artist",
        "Column 3": "genre",
        "Column 4": "condition",
        "Column 5": "catalog_number",
      },
      { firstDataRowNumber: 1 }
    );

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toContain("Row 1: missing artist");
  });

  it("normalizes valid optional purchase prices", () => {
    const result = deriveRows(
      [
        {
          Title: "Buzz Buzz Buzz",
          Artist: "The Hollywood Flames",
          Condition: "VG+",
          Paid: "$12.50",
        },
      ],
      {
        Title: "title",
        Artist: "artist",
        Condition: "condition",
        Paid: "purchase_price",
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0].purchase_price).toBe(12.5);
  });

  it("rejects invalid optional purchase prices before import", () => {
    const result = deriveRows(
      [
        {
          Title: "Buzz Buzz Buzz",
          Artist: "The Hollywood Flames",
          Condition: "Great",
          Paid: "free",
        },
      ],
      {
        Title: "title",
        Artist: "artist",
        Condition: "condition",
        Paid: "purchase_price",
      }
    );

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toContain('Row 2: invalid purchase price "free"');
  });
});
