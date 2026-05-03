import { describe, expect, test } from "bun:test";
import { getOutputMode } from "../src/lib/output";


describe("getOutputMode", () => {
  test("defaults to human output", () => {
    expect(getOutputMode({})).toBe("human");
  });

  test("selects json output", () => {
    expect(getOutputMode({ json: true })).toBe("json");
  });

  test("selects plain output", () => {
    expect(getOutputMode({ plain: true })).toBe("plain");
  });

  test("rejects conflicting output modes", () => {
    expect(() => getOutputMode({ json: true, plain: true })).toThrow("cannot be used together");
  });
});
