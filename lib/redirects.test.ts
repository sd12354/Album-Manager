import { describe, expect, it } from "vitest";
import { safeRelativePath } from "./redirects";

describe("safeRelativePath", () => {
  it("keeps internal paths with query strings and hashes", () => {
    expect(safeRelativePath("/albums/abc?tab=pricing#history")).toBe(
      "/albums/abc?tab=pricing#history"
    );
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safeRelativePath("https://evil.example/albums")).toBe("/dashboard");
    expect(safeRelativePath("//evil.example/albums")).toBe("/dashboard");
  });

  it("falls back for missing or malformed values", () => {
    expect(safeRelativePath(null, "/login")).toBe("/login");
    expect(safeRelativePath("%E0%A4%A")).toBe("/dashboard");
  });
});
