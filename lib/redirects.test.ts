import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "./redirects";

describe("safeInternalRedirect", () => {
  it("keeps relative app paths with query strings", () => {
    expect(safeInternalRedirect("/albums?add=true")).toBe("/albums?add=true");
  });

  it("rejects absolute external URLs", () => {
    expect(safeInternalRedirect("https://evil.example/phish")).toBe(
      "/dashboard"
    );
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeInternalRedirect("//evil.example/phish", "/login")).toBe(
      "/login"
    );
  });

  it("uses the fallback for missing values", () => {
    expect(safeInternalRedirect(null, "/login")).toBe("/login");
  });
});
