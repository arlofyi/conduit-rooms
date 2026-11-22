import { describe, expect, it } from "vitest";
import { parseDraft } from "./hiring";

describe("parseDraft", () => {
  it("splits a draft at its two headings", () => {
    const draft = parseDraft(
      "## Instructions\nYou are the CTO.\nBe blunt.\n\n## Persona\nCTO is a technical advisor.\nAsk me about: architecture.\nNot mine: bugs in one repo.",
    );

    expect(draft.instructions).toBe("You are the CTO.\nBe blunt.");
    expect(draft.persona).toBe("CTO is a technical advisor.\nAsk me about: architecture.\nNot mine: bugs in one repo.");
  });

  it("ignores anything written before the first heading", () => {
    expect(parseDraft("Here you go.\n\n## Instructions\nA\n\n## Persona\nB")).toEqual({ instructions: "A", persona: "B" });
  });

  it("refuses a reply that is missing a part", () => {
    expect(() => parseDraft("## Instructions\nOnly this")).toThrow();
    expect(() => parseDraft("## Persona\nB\n## Instructions\nA")).toThrow();
  });
});
