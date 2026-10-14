import { describe, expect, it } from "vitest";
import { currentPathWithSearch, sanitizeInternalRedirect } from "./redirects";

describe("redirect helpers", () => {
  it("allows internal paths with query strings and hashes", () => {
    expect(sanitizeInternalRedirect("/albums?page=2#row-1")).toBe(
      "/albums?page=2#row-1"
    );
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(sanitizeInternalRedirect("https://evil.example/albums")).toBe(
      "/dashboard"
    );
    expect(sanitizeInternalRedirect("//evil.example/albums")).toBe("/dashboard");
  });

  it("uses the provided fallback for empty or malformed values", () => {
    expect(sanitizeInternalRedirect(null, "/login")).toBe("/login");
    expect(sanitizeInternalRedirect("albums", "/login")).toBe("/login");
  });

  it("preserves path, query, and hash from a URL", () => {
    expect(
      currentPathWithSearch(
        new URL("https://vinylvault.local/albums?sort=artist#beatles")
      )
    ).toBe("/albums?sort=artist#beatles");
  });
});
