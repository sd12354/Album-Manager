import { describe, expect, it } from "vitest";
import { sanitizeInternalPath } from "./redirects";

describe("sanitizeInternalPath", () => {
  it("keeps relative app paths with query strings", () => {
    expect(sanitizeInternalPath("/albums?sort=artist")).toBe(
      "/albums?sort=artist"
    );
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(sanitizeInternalPath("https://evil.example")).toBe("/dashboard");
    expect(sanitizeInternalPath("//evil.example/path")).toBe("/dashboard");
  });

  it("falls back for empty or malformed values", () => {
    expect(sanitizeInternalPath("")).toBe("/dashboard");
    expect(sanitizeInternalPath("dashboard")).toBe("/dashboard");
    expect(sanitizeInternalPath(null, "/login")).toBe("/login");
  });
});

