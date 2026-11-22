import { describe, expect, it } from "vitest";
import { isValidHandle, slugifyHandle, uniqueHandle } from "./handle";

describe("slugifyHandle", () => {
  it.each([
    ["Hobbyist", "hobbyist"],
    ["milega.pk", "milega-pk"],
    ["t4p-hub", "t4p-hub"],
    ["  Founders Circle!  ", "founders-circle"],
    ["a", "a-project"],
    ["???", "project"],
  ])("turns %j into %j", (name, handle) => {
    expect(slugifyHandle(name)).toBe(handle);
    expect(isValidHandle(slugifyHandle(name))).toBe(true);
  });

  it("trims long names to 32 characters without a trailing dash", () => {
    const handle = slugifyHandle("a".repeat(31) + " tail");
    expect(handle).toBe("a".repeat(31));
  });
});

describe("uniqueHandle", () => {
  it("returns the base when it is free", () => {
    expect(uniqueHandle("arlo", new Set())).toBe("arlo");
  });

  it("counts up past taken handles", () => {
    expect(uniqueHandle("arlo", new Set(["arlo", "arlo-2"]))).toBe("arlo-3");
  });

  it("stays within the length limit", () => {
    const base = "a".repeat(32);
    const handle = uniqueHandle(base, new Set([base]));
    expect(handle).toHaveLength(32);
    expect(handle.endsWith("-2")).toBe(true);
  });
});
