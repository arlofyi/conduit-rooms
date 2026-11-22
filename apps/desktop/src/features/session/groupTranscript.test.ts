import type { TranscriptItem } from "@rooms/shared";
import { describe, expect, it } from "vitest";
import { groupTranscript, summariseTools } from "./groupTranscript";

let next = 0;
const item = (kind: TranscriptItem["kind"], text: string = kind, tool?: string): TranscriptItem => ({
  id: `i${(next += 1)}`,
  kind,
  text,
  at: null,
  ...(tool && { tool }),
});

/** A block as a short word, with a turn spelled out part by part. */
const shape = (items: TranscriptItem[]) =>
  groupTranscript(items).map((block) =>
    block.kind === "turn"
      ? block.parts.map((part) => (part.kind === "tools" ? `tools:${part.items.length}` : "text")).join(" ")
      : block.kind,
  );

describe("groupTranscript", () => {
  it("makes one turn of everything Claude does between two things you said", () => {
    const items = [
      item("user"),
      item("assistant"),
      item("tool"),
      item("tool"),
      item("assistant"),
      item("tool"),
      item("user"),
      item("assistant"),
    ];

    expect(shape(items)).toEqual(["user", "text tools:2 text tools:1", "user", "text"]);
  });

  it("starts a new turn after a note, such as where the conversation was summarised", () => {
    expect(shape([item("tool"), item("note"), item("tool"), item("assistant")])).toEqual([
      "tools:1",
      "note",
      "tools:1 text",
    ]);
  });

  it("has nothing to draw for an empty transcript", () => {
    expect(groupTranscript([])).toEqual([]);
  });
});

describe("summariseTools", () => {
  it("counts the calls and names the tools used most", () => {
    const run = [item("tool", "a", "Bash"), item("tool", "b", "Read"), item("tool", "c", "Bash")];
    expect(summariseTools(run)).toBe("3 steps: Bash 2, Read 1");
  });

  it("says there were more when many kinds of tool were used", () => {
    const run = ["Bash", "Read", "Edit", "Grep", "Glob"].map((tool) => item("tool", "x", tool));
    expect(summariseTools(run)).toBe("5 steps: Bash 1, Read 1, Edit 1, and 2 more");
  });

  it("uses the singular for one call", () => {
    expect(summariseTools([item("tool", "x", "Read")])).toBe("1 step: Read 1");
  });
});
