import { describe, expect, it } from "vitest";
import type { WakeAccess } from "./runtime";
import { stepOf } from "./stepOf";

const oneRepo: WakeAccess = { kind: "repo", roots: ["/work/arlo"], maxReads: 8 };
const product: WakeAccess = { kind: "repo", roots: ["/work/arlo", "/work/arlo-desktop"], maxReads: 8 };
const web: WakeAccess = { kind: "web", maxCalls: 8 };

describe("stepOf", () => {
  it("gives a file from the repo's root", () => {
    expect(stepOf("Read", { file_path: "/work/arlo/src/main.ts" }, oneRepo)).toEqual({ kind: "read", subject: "src/main.ts" });
  });

  it("names the repo when there are several to read from", () => {
    expect(stepOf("Read", { file_path: "/work/arlo-desktop/package.json" }, product)).toEqual({
      kind: "read",
      subject: "arlo-desktop/package.json",
    });
  });

  it("keeps what was searched for, and where", () => {
    expect(stepOf("Grep", { pattern: "TODO", path: "/work/arlo/src" }, oneRepo)).toEqual({
      kind: "search",
      subject: "TODO",
      where: "src",
    });
    expect(stepOf("Glob", { pattern: "**/*.md" }, oneRepo)).toEqual({ kind: "find", subject: "**/*.md" });
  });

  it("keeps a web search by its query and a page by its site", () => {
    expect(stepOf("WebSearch", { query: "tauri sidecar" }, web)).toEqual({ kind: "web_search", subject: "tauri sidecar" });
    expect(stepOf("WebFetch", { url: "https://tauri.app/develop/sidecar/" }, web)).toEqual({
      kind: "web_page",
      subject: "tauri.app",
    });
  });

  it("does not fall over on a call with nothing in it", () => {
    expect(stepOf("Read", null, oneRepo)).toEqual({ kind: "read", subject: "" });
    expect(stepOf("Mystery", {}, web)).toEqual({ kind: "other", subject: "Mystery" });
  });
});
