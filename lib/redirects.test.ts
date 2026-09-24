import { describe, expect, it } from "vitest";
import { buildCurrentPath, sanitizeInternalPath } from "./redirects";

describe("redirect helpers", () => {
  it("keeps internal paths with search and hash", () => {
    expect(sanitizeInternalPath("/albums?add=true#top", "/dashboard")).toBe(
      "/albums?add=true#top"
    );
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(sanitizeInternalPath("https://evil.example/phish", "/login")).toBe(
      "/login"
    );
    expect(sanitizeInternalPath("//evil.example/phish", "/login")).toBe(
      "/login"
    );
  });

  it("builds the current request path for login redirects", () => {
    expect(buildCurrentPath("/dashboard", "?tab=sales")).toBe(
      "/dashboard?tab=sales"
    );
  });
});
