import { describe, expect, it } from "vitest";
import { isIdOf, newId } from "./ids";

describe("newId", () => {
  it("carries its type prefix", () => {
    expect(newId("message")).toMatch(/^msg_[0-9a-z]{26}$/);
    expect(isIdOf("message", newId("message"))).toBe(true);
    expect(isIdOf("room", newId("message"))).toBe(false);
  });

  it("sorts by creation time", () => {
    const earlier = newId("message", 1_000_000);
    const later = newId("message", 2_000_000);
    expect(earlier < later).toBe(true);
  });

  it("keeps minting order within one millisecond", () => {
    const now = 3_000_000;
    const ids = Array.from({ length: 500 }, () => newId("message", now));
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });
});
