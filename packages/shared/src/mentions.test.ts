import { describe, expect, it } from "vitest";
import { findMentions, splitMentions } from "./mentions";

describe("findMentions", () => {
  it("finds handles in order, once each, lowercased", () => {
    expect(findMentions("@hobbyist and @Conduit, then @hobbyist again")).toEqual(["hobbyist", "conduit"]);
  });

  it("accepts a mention at the start, after punctuation and before punctuation", () => {
    expect(findMentions("(@arlo) what about @milega-pk?")).toEqual(["arlo", "milega-pk"]);
  });

  it("ignores things that only look like mentions", () => {
    expect(findMentions("mail me at uzair@example.com, see packages/@rooms/shared")).toEqual([]);
  });

  it("reads @all as a handle of its own", () => {
    expect(findMentions("@all status?")).toEqual(["all"]);
  });
});

describe("splitMentions", () => {
  it("keeps every character, in order", () => {
    const parts = splitMentions("hey @arlo, ship it");
    expect(parts).toEqual([
      { text: "hey ", handle: null },
      { text: "@arlo", handle: "arlo" },
      { text: ", ship it", handle: null },
    ]);
    expect(parts.map((part) => part.text).join("")).toBe("hey @arlo, ship it");
  });
});
