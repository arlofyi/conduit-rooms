import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * Decides, for every tool call a lead makes, whether it may run.
 *
 * A lead may read its own repo and nothing else (invariant I8, R-ROOM-11).
 * A product's lead has several: the repos you put under that product.
 * The Agent SDK is already told to offer only read tools and to deny anything
 * that would prompt. This guard is the layer that does not depend on those
 * settings: it sees the actual path of every call and denies any that leaves
 * the project, and it enforces the read budget (R-LEAD-16).
 */

export type GuardDecision = { allow: true } | { allow: false; reason: string };

/** Decides whether one tool call may run. Every wake has exactly one. */
export interface ToolGuard {
  check(toolName: string, toolInput: unknown): GuardDecision;
}

export type RepoGuard = ToolGuard;

export const READ_TOOLS = ["Read", "Glob", "Grep"] as const;

const ALLOW: GuardDecision = { allow: true };

/** `roots` are the folders that may be read. A relative path is taken from the first. */
export function createRepoGuard(roots: readonly [string, ...string[]], maxReads: number): RepoGuard {
  const allowed = roots.map(canonical);
  const home = allowed[0]!;
  let reads = 0;

  const isAllowed = (path: string) => {
    const target = canonical(isAbsolute(path) ? path : resolve(home, path));
    return allowed.some((root) => isInside(root, target));
  };

  return {
    check(toolName, toolInput) {
      if (!isReadTool(toolName)) {
        return deny(`${toolName} is not available. You can only read files in ${yours(roots)}.`);
      }

      const escaped = pathsIn(toolName, toolInput).find((path) => !isAllowed(path));
      if (escaped !== undefined) {
        return deny(`${escaped} is outside ${yours(roots)}. You cannot read it.`);
      }

      reads += 1;
      if (reads > maxReads) {
        return deny(
          `You have used all ${maxReads} of your reads. Answer now with what you know, ` +
            "and say what you would still need to look into.",
        );
      }

      return ALLOW;
    },
  };
}

function yours(roots: readonly string[]): string {
  return roots.length === 1 ? "your own repo" : "your product's repos";
}

function deny(reason: string): GuardDecision {
  return { allow: false, reason };
}

function isReadTool(name: string): name is (typeof READ_TOOLS)[number] {
  return (READ_TOOLS as readonly string[]).includes(name);
}

/** Every filesystem location a tool call would touch. */
function pathsIn(toolName: (typeof READ_TOOLS)[number], toolInput: unknown): string[] {
  const input = (toolInput ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof input[key] === "string" ? [input[key] as string] : []);

  switch (toolName) {
    case "Read":
      return text("file_path");
    case "Glob":
      // A glob pattern can itself be absolute or climb with "..".
      return [...text("path"), ...text("pattern").map(staticPrefix)];
    case "Grep":
      return [...text("path"), ...text("glob").map(staticPrefix)];
  }
}

/** The directory part of a glob before its first wildcard: "../other/**" gives "../other". */
function staticPrefix(pattern: string): string {
  const firstWildcard = pattern.search(/[*?[{]/);
  const fixed = firstWildcard === -1 ? pattern : pattern.slice(0, firstWildcard);
  const lastSlash = fixed.lastIndexOf("/");
  return lastSlash === -1 ? "." : fixed.slice(0, lastSlash) || "/";
}

/** `target` is already canonical. */
function isInside(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !isAbsolute(fromRoot));
}

/** Resolves symlinks so a link inside the repo cannot point a read outside it. */
function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    // The path does not exist yet. Its lexical form is all there is to check.
    return resolve(path);
  }
}

// ---- App tools: asking a lead, reading a brief ----

/**
 * Lets a wake call the app tools it was given, up to a budget of their own,
 * and leaves every other call to the guard for its repo or the web.
 * `names` are the tools' names as the runtime presents them to the model.
 */
export function allowingAppTools(guard: ToolGuard, names: readonly string[], maxCalls: number): ToolGuard {
  let calls = 0;

  return {
    check(toolName, toolInput) {
      if (!names.includes(toolName)) return guard.check(toolName, toolInput);

      calls += 1;
      return calls > maxCalls
        ? deny(`You have used all ${maxCalls} of your calls to Rooms. Answer now with what you have.`)
        : ALLOW;
    },
  };
}

// ---- Hired agents: the web, and nothing on this machine ----

export const WEB_TOOLS = ["WebSearch", "WebFetch"] as const;

/**
 * The guard for a hired agent. It has no repo, so the only tools it may use
 * are web search and fetching a page, up to a budget. Anything that would
 * touch this machine is refused.
 */
export function createWebGuard(maxCalls: number): ToolGuard {
  let calls = 0;

  return {
    check(toolName) {
      if (!(WEB_TOOLS as readonly string[]).includes(toolName)) {
        return deny(`${toolName} is not available. You can search the web and read pages, and nothing else.`);
      }

      calls += 1;
      if (calls > maxCalls) {
        return deny(
          `You have used all ${maxCalls} of your web lookups. Answer now with what you found, ` +
            "and say what you would still need to check.",
        );
      }

      return ALLOW;
    },
  };
}
