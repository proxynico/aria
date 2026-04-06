import { describe, expect, test } from "bun:test";
import { parseInteger } from "../src/lib/input";

describe("parseInteger", () => {
  test("parses bounded integers", () => {
    expect(parseInteger("limit", "12", { min: 1, max: 20 })).toBe(12);
  });

  test("rejects non-integers", () => {
    expect(() => parseInteger("limit", "1.2")).toThrow("limit must be an integer");
  });

  test("rejects out-of-range values", () => {
    expect(() => parseInteger("offset", "-1", { min: 0 })).toThrow("offset must be at least 0");
  });
});
