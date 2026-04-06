import { describe, expect, test } from "bun:test";
import { validateRawId, parseEntityRef } from "../src/lib/entities";

describe("validateRawId", () => {
  test("accepts hex persistent IDs", () => {
    expect(validateRawId("ABC123DEF456", "Track")).toBe("ABC123DEF456");
  });

  test("accepts API-style IDs with dots", () => {
    expect(validateRawId("l.ABC123", "Playlist")).toBe("l.ABC123");
  });

  test("accepts IDs with hyphens", () => {
    expect(validateRawId("pl.u-abc-123", "Playlist")).toBe("pl.u-abc-123");
  });

  test("rejects empty IDs", () => {
    expect(() => validateRawId("", "Track")).toThrow("contains invalid characters");
  });

  test("rejects IDs with quotes", () => {
    expect(() => validateRawId('abc"def', "Track")).toThrow("contains invalid characters");
  });

  test("rejects IDs with semicolons", () => {
    expect(() => validateRawId("abc;evil()", "Track")).toThrow("contains invalid characters");
  });

  test("rejects IDs with parentheses", () => {
    expect(() => validateRawId("abc()", "Track")).toThrow("contains invalid characters");
  });

  test("rejects IDs with backticks", () => {
    expect(() => validateRawId("abc`rm -rf /`", "Track")).toThrow("contains invalid characters");
  });

  test("rejects IDs with newlines", () => {
    expect(() => validateRawId("abc\ndef", "Track")).toThrow("contains invalid characters");
  });
});

describe("parseEntityRef", () => {
  test("parses native persistent ref", () => {
    const ref = parseEntityRef("native:persistent:ABC123");
    expect(ref).toEqual({ source: "native", kind: "persistent", value: "ABC123" });
  });

  test("parses api library ref", () => {
    const ref = parseEntityRef("api:library:l.123");
    expect(ref).toEqual({ source: "api", kind: "library", value: "l.123" });
  });

  test("parses api catalog ref", () => {
    const ref = parseEntityRef("api:catalog:1234567");
    expect(ref).toEqual({ source: "api", kind: "catalog", value: "1234567" });
  });

  test("returns null for raw IDs", () => {
    expect(parseEntityRef("ABC123")).toBeNull();
  });

  test("returns null for malformed refs", () => {
    expect(parseEntityRef("unknown:persistent:123")).toBeNull();
  });
});
