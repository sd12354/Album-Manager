import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./redirects";

describe("getSafeRedirectPath", () => {
  it("keeps relative app paths including query strings and hashes", () => {
    expect(getSafeRedirectPath("/albums?sort=artist#row-2")).toBe(
      "/albums?sort=artist#row-2"
    );
  });

  it("falls back for absolute and protocol-relative URLs", () => {
    expect(getSafeRedirectPath("https://evil.example/phish")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("falls back for empty or malformed values", () => {
    expect(getSafeRedirectPath("")).toBe("/dashboard");
    expect(getSafeRedirectPath("   ")).toBe("/dashboard");
    expect(getSafeRedirectPath("http://[::1")).toBe("/dashboard");
  });

  it("supports a custom fallback", () => {
    expect(getSafeRedirectPath("https://evil.example", "/login")).toBe(
      "/login"
    );
  });
});

