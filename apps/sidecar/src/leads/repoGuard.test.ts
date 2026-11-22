import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createRepoGuard, createWebGuard } from "./repoGuard";

let repo: string;
let outside: string;

beforeAll(() => {
  const base = mkdtempSync(join(tmpdir(), "rooms-guard-"));
  repo = join(base, "repo");
  outside = join(base, "other-project");

  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(outside);
  writeFileSync(join(repo, "src", "main.ts"), "");
  writeFileSync(join(outside, "secret.ts"), "");
  symlinkSync(outside, join(repo, "linked"));
});

describe("createRepoGuard", () => {
  it("allows reads inside the repo, absolute or relative", () => {
    const guard = createRepoGuard([repo], 8);

    expect(guard.check("Read", { file_path: join(repo, "src/main.ts") })).toEqual({ allow: true });
    expect(guard.check("Read", { file_path: "src/main.ts" })).toEqual({ allow: true });
    expect(guard.check("Glob", { pattern: "src/**/*.ts" })).toEqual({ allow: true });
    expect(guard.check("Grep", { pattern: "TODO", path: "src" })).toEqual({ allow: true });
  });

  it.each([
    ["an absolute path elsewhere", "Read", () => ({ file_path: join(outside, "secret.ts") })],
    ["a climbing relative path", "Read", () => ({ file_path: "../other-project/secret.ts" })],
    ["a symlink that leaves the repo", "Read", () => ({ file_path: "linked/secret.ts" })],
    ["a glob rooted elsewhere", "Glob", () => ({ pattern: `${outside}/**/*.ts` })],
    ["a glob that climbs", "Glob", () => ({ pattern: "../**/*.ts" })],
    ["a search path elsewhere", "Grep", () => ({ pattern: "x", path: outside })],
    ["a search filter that climbs", "Grep", () => ({ pattern: "x", glob: "../other-project/*.ts" })],
  ])("denies %s", (_label, tool, input) => {
    const decision = createRepoGuard([repo], 8).check(tool, input());
    expect(decision.allow).toBe(false);
  });

  it("denies every tool that is not a read tool", () => {
    const guard = createRepoGuard([repo], 8);

    for (const tool of ["Write", "Edit", "Bash", "Agent", "WebFetch", "mcp__anything__tool"]) {
      expect(guard.check(tool, {}).allow).toBe(false);
    }
  });

  it("stops allowing reads once the budget is spent", () => {
    const guard = createRepoGuard([repo], 2);
    const read = () => guard.check("Read", { file_path: "src/main.ts" });

    expect(read().allow).toBe(true);
    expect(read().allow).toBe(true);
    expect(read()).toMatchObject({ allow: false, reason: expect.stringContaining("Answer now") });
  });

  it("does not spend budget on a denied read", () => {
    const guard = createRepoGuard([repo], 1);

    guard.check("Read", { file_path: join(outside, "secret.ts") });
    expect(guard.check("Read", { file_path: "src/main.ts" }).allow).toBe(true);
  });
});

describe("createRepoGuard for a product", () => {
  it("allows reads in every repo of the product, and takes a relative path from the first", () => {
    const guard = createRepoGuard([repo, outside], 8);

    expect(guard.check("Read", { file_path: join(outside, "secret.ts") })).toEqual({ allow: true });
    expect(guard.check("Read", { file_path: "src/main.ts" })).toEqual({ allow: true });
    expect(guard.check("Grep", { pattern: "x", path: outside })).toEqual({ allow: true });
  });

  it("still denies a folder that is in neither", () => {
    const guard = createRepoGuard([repo, outside], 8);
    expect(guard.check("Read", { file_path: "/etc/hosts" }).allow).toBe(false);
  });
});

describe("createWebGuard", () => {
  it("allows searching and fetching, up to its budget", () => {
    const guard = createWebGuard(2);

    expect(guard.check("WebSearch", { query: "tauri sidecar" }).allow).toBe(true);
    expect(guard.check("WebFetch", { url: "https://tauri.app" }).allow).toBe(true);
    expect(guard.check("WebSearch", { query: "again" })).toMatchObject({
      allow: false,
      reason: expect.stringContaining("Answer now"),
    });
  });

  it("refuses everything that would touch this machine", () => {
    const guard = createWebGuard(8);

    for (const tool of ["Read", "Glob", "Grep", "Write", "Edit", "Bash", "Agent"]) {
      expect(guard.check(tool, { file_path: "/etc/hosts" }).allow).toBe(false);
    }
  });
});
