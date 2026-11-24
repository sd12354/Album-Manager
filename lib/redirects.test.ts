import { describe, expect, it } from "vitest";
import { currentPathWithSearch, sanitizeNextPath } from "./redirects";

describe("sanitizeNextPath", () => {
  it("keeps safe internal destinations", () => {
    expect(sanitizeNextPath("/albums/123?tab=photos#cover")).toBe(
      "/albums/123?tab=photos#cover"
    );
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(sanitizeNextPath("https://evil.example/phish")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("normalizes same-origin absolute URLs and falls back for invalid values", () => {
    expect(sanitizeNextPath("https://vinylvault.local/settings?connected=true")).toBe(
      "/settings?connected=true"
    );
    expect(sanitizeNextPath("not a url")).toBe("/dashboard");
    expect(sanitizeNextPath(null)).toBe("/dashboard");
  });
});

describe("currentPathWithSearch", () => {
  it("preserves path, query, and hash for login next links", () => {
    const url = new URL("https://app.example/albums/abc?view=photos#match");
    expect(currentPathWithSearch(url)).toBe("/albums/abc?view=photos#match");
  });
});
