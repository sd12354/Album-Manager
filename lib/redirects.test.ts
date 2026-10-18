import { describe, expect, it } from "vitest";
import { protectedLoginPath, sanitizeInternalPath } from "./redirects";

describe("redirect helpers", () => {
  it("allows relative app paths including query strings", () => {
    expect(sanitizeInternalPath("/albums?sort=artist")).toBe("/albums?sort=artist");
    expect(sanitizeInternalPath("/settings#discogs")).toBe("/settings#discogs");
  });

  it("rejects external or protocol-relative destinations", () => {
    expect(sanitizeInternalPath("https://evil.example/albums")).toBe("/dashboard");
    expect(sanitizeInternalPath("//evil.example/albums")).toBe("/dashboard");
    expect(sanitizeInternalPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("encodes protected destinations for login", () => {
    expect(protectedLoginPath("/albums", "?sort=artist")).toBe(
      "/login?next=%2Falbums%3Fsort%3Dartist"
    );
  });
});
