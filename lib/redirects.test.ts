import { describe, expect, it } from "vitest";
import { safePostAuthRedirectPath } from "./redirects";

describe("safePostAuthRedirectPath", () => {
  it("allows internal app paths with query strings and hashes", () => {
    expect(safePostAuthRedirectPath("/albums/123?tab=pricing#top")).toBe(
      "/albums/123?tab=pricing#top"
    );
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safePostAuthRedirectPath("https://evil.example/albums")).toBe(
      "/dashboard"
    );
    expect(safePostAuthRedirectPath("//evil.example/albums")).toBe(
      "/dashboard"
    );
  });

  it("rejects auth-flow destinations that would loop after sign-in", () => {
    expect(safePostAuthRedirectPath("/login?next=/albums")).toBe("/dashboard");
    expect(safePostAuthRedirectPath("/auth/callback?code=abc")).toBe(
      "/dashboard"
    );
  });

  it("rejects malformed path tricks", () => {
    expect(safePostAuthRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safePostAuthRedirectPath(" /albums")).toBe("/albums");
  });
});

