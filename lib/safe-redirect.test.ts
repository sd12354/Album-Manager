import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "./safe-redirect";

describe("sanitizeNextPath", () => {
  it("preserves safe relative app destinations", () => {
    expect(sanitizeNextPath("/albums?missing=photos#top")).toBe(
      "/albums?missing=photos#top"
    );
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(sanitizeNextPath("https://evil.example/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.example/dashboard")).toBe("/dashboard");
  });

  it("rejects login loops and malformed relative paths", () => {
    expect(sanitizeNextPath("/login?next=/settings")).toBe("/dashboard");
    expect(sanitizeNextPath("settings")).toBe("/dashboard");
    expect(sanitizeNextPath("/\\evil.example")).toBe("/dashboard");
  });
});
