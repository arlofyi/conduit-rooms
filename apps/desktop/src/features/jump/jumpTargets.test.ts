import { describe, expect, it } from "vitest";
import { matchJumpTargets, type JumpTarget } from "./jumpTargets";

const target = (label: string, context: string | null = null): JumpTarget => ({
  id: label,
  kind: "project",
  label,
  context,
  view: { kind: "room", conversationId: label },
});

const labels = (targets: JumpTarget[]) => targets.map((entry) => entry.label);

describe("matchJumpTargets", () => {
  const targets = [target("plugin-api"), target("arlo"), target("baby-arlo"), target("Session 3", "arlo-desktop"), target("orbit")];

  it("returns everything, in order, when nothing is typed", () => {
    expect(labels(matchJumpTargets(targets, "  "))).toEqual(labels(targets));
  });

  it("puts names that start with what was typed before names that contain it, then matches on where a thing belongs", () => {
    expect(labels(matchJumpTargets(targets, "Arlo"))).toEqual(["arlo", "baby-arlo", "Session 3"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(matchJumpTargets(targets, "zebra")).toEqual([]);
  });
});
