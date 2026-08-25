import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("safe redirects", () => {
  it("allows relative paths with query strings", () => {
    expect(getSafeRedirectPath("/albums?add=true")).toBe("/albums?add=true");
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(getSafeRedirectPath("https://evil.example/phish")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("rejects malformed backslash paths", () => {
    expect(getSafeRedirectPath("/\\evil.example")).toBe("/dashboard");
  });
});
