import { describe, expect, it } from "vitest";
import { projectStatus, sessionStatus } from "./activity";

describe("sessionStatus", () => {
  it.each([
    ["running", false, "working"],
    ["needsInput", false, "needs_you"],
    ["done", false, "done"],
    ["idle", false, "idle"],
    [null, false, "idle"],
    ["running", true, "stopped"],
  ] as const)("reads %j (stopped: %j) as %j", (agentState, stopped, status) => {
    expect(sessionStatus(agentState, stopped)).toBe(status);
  });
});

describe("projectStatus", () => {
  it("puts needing you ahead of working, and working ahead of idle", () => {
    expect(projectStatus([{ status: "working" }, { status: "needs_you" }])).toBe("needs_you");
    expect(projectStatus([{ status: "done" }, { status: "working" }])).toBe("working");
    expect(projectStatus([{ status: "done" }, { status: "stopped" }])).toBe("idle");
    expect(projectStatus([])).toBe("idle");
  });
});
