import { describe, expect, test } from "bun:test";
import { buildIdentity, parseEntityRef } from "../src/lib/entities";

describe("entity refs", () => {
  test("encodes native persistent ids explicitly", () => {
    const identity = buildIdentity({ source: "native", persistentId: "ABC123" });
    expect(identity.id).toBe("native:persistent:ABC123");
    expect(identity.persistentId).toBe("ABC123");
  });

  test("prefers library ids for API library entities", () => {
    const identity = buildIdentity({
      source: "api",
      libraryId: "l.123",
      catalogId: "c.456",
    });
    expect(identity.id).toBe("api:library:l.123");
    expect(identity.catalogId).toBe("c.456");
  });

  test("parses encoded refs", () => {
    expect(parseEntityRef("api:catalog:123")).toEqual({
      source: "api",
      kind: "catalog",
      value: "123",
    });
  });
});
