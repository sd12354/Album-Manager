import { describe, expect, it } from "vitest";
import { deriveRows, parseAlbumCSV } from "./csv";

describe("CSV album import helpers", () => {
  it("reports row 1 for invalid headerless CSV data", async () => {
    const file = new File(["Missing Artist,,Rock,Great,ABC-1"], "albums.csv", {
      type: "text/csv",
    });

    const result = await parseAlbumCSV(file, { hasHeaderRow: false });

    expect(result.headerless).toBe(true);
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
