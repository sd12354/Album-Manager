import { describe, expect, it } from "vitest";
import { requestedPathFromUrl, sanitizeRedirectPath } from "./redirects";

describe("sanitizeRedirectPath", () => {
  it("keeps internal app paths with query strings and hashes", () => {
    expect(sanitizeRedirectPath("/albums/abc?tab=pricing#history")).toBe(
      "/albums/abc?tab=pricing#history"
    );
  });

  it("rejects external, protocol-relative, and non-path redirects", () => {
    expect(sanitizeRedirectPath("https://evil.example/albums")).toBe("/dashboard");
    expect(sanitizeRedirectPath("//evil.example/albums")).toBe("/dashboard");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeRedirectPath("albums/abc")).toBe("/dashboard");
  });

  it("rejects auth-flow loops", () => {
    expect(sanitizeRedirectPath("/login?next=/albums")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/signup")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/auth/callback?code=secret")).toBe("/dashboard");
  });

  it("builds requested paths from URL parts", () => {
    const url = new URL("https://vinylvault.local/import?step=review#photos");
    expect(requestedPathFromUrl(url)).toBe("/import?step=review#photos");
  });
});
