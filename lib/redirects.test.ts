import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirects";

describe("safeRedirectPath", () => {
  it("keeps internal paths with query strings", () => {
    expect(safeRedirectPath("/albums?add=true")).toBe("/albums?add=true");
  });

  it("rejects external and protocol-relative targets", () => {
    expect(safeRedirectPath("https://evil.example/phish")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("uses a custom fallback for missing or unsafe values", () => {
    expect(safeRedirectPath(null, "/login")).toBe("/login");
    expect(safeRedirectPath("dashboard", "/login")).toBe("/login");
  });
});
