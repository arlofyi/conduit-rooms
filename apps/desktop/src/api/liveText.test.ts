import { describe, expect, it } from "vitest";
import { applyDelta, clearLiveText } from "./liveText";

describe("applyDelta", () => {
  it("appends pieces that arrive in order", () => {
    expect(applyDelta("m1", 0, "Hello")).toBe("applied");
    expect(applyDelta("m1", 5, " there")).toBe("applied");
    clearLiveText("m1");
  });

  it("skips a piece it already has", () => {
    applyDelta("m2", 0, "Hello");
    expect(applyDelta("m2", 0, "Hello")).toBe("already_have");
    clearLiveText("m2");
  });

  it("reports a gap when it started listening late", () => {
    expect(applyDelta("m3", 40, "late")).toBe("gap");
  });

  it("continues from a body fetched mid-reply", () => {
    expect(applyDelta("m4", 5, " there", "Hello")).toBe("applied");
    expect(applyDelta("m4", 11, "!")).toBe("applied");
    clearLiveText("m4");
  });
});
