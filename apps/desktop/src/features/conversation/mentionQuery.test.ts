import { describe, expect, it } from "vitest";
import { filterMentionOptions, insertMention, mentionQueryAt } from "./mentionQuery";

describe("mentionQueryAt", () => {
  it("opens on @ at the start and after whitespace", () => {
    expect(mentionQueryAt("@", 1)).toEqual({ query: "", start: 0 });
    expect(mentionQueryAt("hey @hob", 8)).toEqual({ query: "hob", start: 4 });
  });

  it("stays closed inside a word, and once the mention is finished", () => {
    expect(mentionQueryAt("mail@hob", 8)).toBeNull();
    expect(mentionQueryAt("@hobbyist ", 10)).toBeNull();
  });

  it("looks only at the text before the caret", () => {
    expect(mentionQueryAt("@hob and more", 4)).toEqual({ query: "hob", start: 0 });
  });
});

describe("insertMention", () => {
  it("replaces what was typed and keeps the rest", () => {
    const at = mentionQueryAt("ask @hob about it", 8)!;
    expect(insertMention("ask @hob about it", 8, at, "hobbyist")).toEqual({
      text: "ask @hobbyist  about it",
      caret: 14,
    });
  });
});

describe("filterMentionOptions", () => {
  const options = [
    { handle: "arlo", label: "Arlo" },
    { handle: "conduit", label: "Conduit" },
    { handle: "fc", label: "Founders Circle" },
  ];

  it("puts handle prefixes before label matches", () => {
    expect(filterMentionOptions(options, "c").map((option) => option.handle)).toEqual(["conduit", "fc"]);
  });
});
