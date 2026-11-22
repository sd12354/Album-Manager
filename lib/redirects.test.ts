import { describe, expect, it } from "vitest";
import {
  protectedLoginPath,
  redirectPathFromSearch,
  sanitizeInternalRedirect,
} from "./redirects";

describe("auth redirect helpers", () => {
  it("wraps protected destinations in a next parameter", () => {
    expect(protectedLoginPath("/dashboard", "?tab=overview")).toBe(
      "/login?next=%2Fdashboard%3Ftab%3Doverview"
    );
    expect(protectedLoginPath("/settings")).toBe(
      "/login?next=%2Fsettings"
    );
  });

  it("allows only internal app paths", () => {
    expect(sanitizeInternalRedirect("/albums?sort=artist#top")).toBe(
      "/albums?sort=artist#top"
    );
    expect(sanitizeInternalRedirect("https://evil.example")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("//evil.example/path")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("%2F%2Fevil.example%2Fpath")).toBe(
      "/dashboard"
    );
    expect(sanitizeInternalRedirect("dashboard")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("%E0%A4%A")).toBe("/dashboard");
  });

  it("reads next from a query string safely", () => {
    expect(redirectPathFromSearch("?next=%2Fimport%3Fstep%3Dmap")).toBe(
      "/import?step=map"
    );
    expect(redirectPathFromSearch("?next=https%3A%2F%2Fevil.example")).toBe(
      "/dashboard"
    );
  });
});
