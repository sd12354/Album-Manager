import { describe, expect, it } from "vitest";
import { deriveRows, detectColumnMapping } from "./csv";

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

  describe("detectColumnMapping", () => {
    const rows = [
      { "Item Name": "Abbey Road", "Recording Artist": "The Beatles", Grade: "VG+", "Cat#": "PCS 7088" },
      { "Item Name": "Kind of Blue", "Recording Artist": "Miles Davis", Grade: "Mint", "Cat#": "CS 8163" },
    ];

    it("maps Discogs/eBay-style headers via the alias table", () => {
      const { mapping, detail } = detectColumnMapping(
        ["Item Name", "Recording Artist", "Grade", "Cat#"],
        rows
      );
      expect(mapping["Item Name"]).toBe("title");
      expect(mapping["Recording Artist"]).toBe("artist");
      expect(mapping.Grade).toBe("condition");
      expect(mapping["Cat#"]).toBe("catalog_number");
      expect(detail.Grade.via).toBe("alias");
    });

    it("fuzzy-matches mistyped headers", () => {
      const { mapping, detail } = detectColumnMapping(
        ["Titel", "Artst", "Conditon"],
        [{ Titel: "X", Artst: "Y", Conditon: "Mint" }]
      );
      expect(mapping.Titel).toBe("title");
      expect(mapping.Artst).toBe("artist");
      expect(mapping.Conditon).toBe("condition");
      expect(detail.Titel.via).toBe("fuzzy");
    });

    it("infers condition column from cell content when header is unknown", () => {
      const { mapping, detail } = detectColumnMapping(
        ["Album", "Artist", "Quality Of Disc"],
        [
          { Album: "A", Artist: "X", "Quality Of Disc": "VG+" },
          { Album: "B", Artist: "Y", "Quality Of Disc": "Mint" },
          { Album: "C", Artist: "Z", "Quality Of Disc": "G+" },
        ]
      );
      // "Quality Of Disc" isn't an exact alias (only "quality" alone is), so
      // content inference (VG+/Mint/G+ all parse as conditions) takes over.
      expect(mapping["Quality Of Disc"]).toBe("condition");
      expect(detail["Quality Of Disc"].via).toBe("content");
    });

    it("does not double-assign the same target to two columns", () => {
      const { mapping } = detectColumnMapping(
        ["Title", "Album"],
        [{ Title: "A", Album: "B" }]
      );
      const targets = Object.values(mapping).filter((t) => t === "title");
      expect(targets).toHaveLength(1);
    });
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
