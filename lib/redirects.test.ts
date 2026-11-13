import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "./redirects";

describe("sanitizeRedirectPath", () => {
  it("keeps safe internal paths with query strings and hashes", () => {
    expect(sanitizeRedirectPath("/albums?status=listed#top")).toBe(
      "/albums?status=listed#top"
    );
  });

  it("rejects external or protocol-relative destinations", () => {
    expect(sanitizeRedirectPath("https://evil.example/albums")).toBe("/dashboard");
    expect(sanitizeRedirectPath("//evil.example/albums")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/\\evil.example")).toBe("/dashboard");
  });

  it("rejects auth loop destinations", () => {
    expect(sanitizeRedirectPath("/login?next=/albums")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/signup")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/auth/callback?code=abc")).toBe("/dashboard");
  });

  it("supports an explicit fallback", () => {
    expect(sanitizeRedirectPath(null, "/login")).toBe("/login");
  });
});
