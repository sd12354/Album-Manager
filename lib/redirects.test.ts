import { describe, expect, it } from "vitest";
import { safeRelativePath } from "./redirects";

describe("safeRelativePath", () => {
  it("keeps internal relative paths with query strings and hashes", () => {
    expect(safeRelativePath("/albums/abc?tab=pricing#notes")).toBe(
      "/albums/abc?tab=pricing#notes"
    );
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(safeRelativePath("https://evil.example/albums")).toBe("/dashboard");
    expect(safeRelativePath("//evil.example/albums")).toBe("/dashboard");
    expect(safeRelativePath("/\\evil.example")).toBe("/dashboard");
  });

  it("falls back for missing or malformed values", () => {
    expect(safeRelativePath(null, "/login")).toBe("/login");
    expect(safeRelativePath("dashboard", "/login")).toBe("/login");
    expect(safeRelativePath("/albums\u0000bad", "/login")).toBe("/login");
  });
});
