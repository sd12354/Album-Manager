import { describe, expect, it } from "vitest";
import { buildAuthCallbackUrl, getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("allows relative app paths with query strings", () => {
    expect(getSafeRedirectPath("/albums?missing=photos")).toBe(
      "/albums?missing=photos"
    );
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(getSafeRedirectPath("https://evil.test/albums")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.test/albums")).toBe("/dashboard");
  });

  it("rejects callback loops", () => {
    expect(getSafeRedirectPath("/auth/callback?next=/settings")).toBe(
      "/dashboard"
    );
  });
});

describe("buildAuthCallbackUrl", () => {
  it("builds callback URLs with sanitized next destinations", () => {
    expect(buildAuthCallbackUrl("/settings")).toBe(
      "/auth/callback?next=%2Fsettings"
    );
    expect(buildAuthCallbackUrl("https://evil.test")).toBe(
      "/auth/callback?next=%2Fdashboard"
    );
  });
});
