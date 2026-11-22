import { describe, expect, it } from "vitest";
import { describeStep, summariseSteps, type ReplyStep } from "./steps";

const read = (subject: string): ReplyStep => ({ kind: "read", subject });

describe("describeStep", () => {
  it("says a step in the present while it happens and in the past once it has", () => {
    expect(describeStep(read("src/main.ts"), "doing")).toBe("Reading src/main.ts");
    expect(describeStep(read("src/main.ts"), "done")).toBe("Read src/main.ts");
  });

  it("quotes what was searched for, and says where", () => {
    expect(describeStep({ kind: "search", subject: "TODO", where: "src" }, "done")).toBe('Searched for "TODO" in src');
    expect(describeStep({ kind: "find", subject: "**/*.md" }, "doing")).toBe("Looking for **/*.md");
    expect(describeStep({ kind: "web_search", subject: "tauri sidecar" }, "doing")).toBe(
      'Searching the web for "tauri sidecar"',
    );
  });
});

describe("summariseSteps", () => {
  it("counts searches and reads in one line", () => {
    const steps: ReplyStep[] = [{ kind: "search", subject: "x" }, read("a"), read("b")];
    expect(summariseSteps(steps)).toBe("Searched once, read 2 files");
  });

  it("counts a file search and a text search together, and pages apart from files", () => {
    const steps: ReplyStep[] = [
      { kind: "find", subject: "*.md" },
      { kind: "web_search", subject: "x" },
      { kind: "web_page", subject: "tauri.app" },
    ];
    expect(summariseSteps(steps)).toBe("Searched twice, read 1 page");
  });

  it("has nothing to say about a reply with no steps", () => {
    expect(summariseSteps([])).toBeNull();
  });

  it("counts what was done in Rooms itself, with leads asked first", () => {
    const steps: ReplyStep[] = [
      { kind: "read_brief", subject: "arlo" },
      { kind: "ask", subject: "arlo-desktop" },
      { kind: "ask", subject: "arlo" },
      { kind: "sessions", subject: "arlo" },
    ];
    expect(summariseSteps(steps)).toBe("Asked 2 leads, read 1 brief, checked sessions");
    expect(describeStep(steps[1]!, "doing")).toBe("Asking arlo-desktop");
  });
});
