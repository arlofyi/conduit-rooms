import type { ReplyStep } from "@rooms/shared";
import { basename, isAbsolute, relative } from "node:path";
import type { WakeAccess } from "./runtime";

/**
 * Turns one tool call into the step it is: which file was read, what was
 * searched for. Paths are given from the repo's root, with the repo's name in
 * front when a product's lead has several to read from. How a step is put
 * into words is decided in packages/shared/src/steps.ts.
 */
export function stepOf(toolName: string, toolInput: unknown, access: WakeAccess): ReplyStep {
  const input = (toolInput ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  const roots = access.kind === "repo" ? access.roots : [];
  const where = text("path") ? { where: shortPath(text("path"), roots) } : {};

  switch (toolName) {
    case "Read":
      return { kind: "read", subject: shortPath(text("file_path"), roots) };
    case "Glob":
      return { kind: "find", subject: clip(text("pattern")), ...where };
    case "Grep":
      return { kind: "search", subject: clip(text("pattern")), ...where };
    case "WebSearch":
      return { kind: "web_search", subject: clip(text("query")) };
    case "WebFetch":
      return { kind: "web_page", subject: hostOf(text("url")) };
    default:
      return { kind: "other", subject: toolName };
  }
}

const MAX_SHOWN = 80;

function clip(value: string): string {
  return value.length > MAX_SHOWN ? `${value.slice(0, MAX_SHOWN)}...` : value;
}

/** A path as someone working in the repo would say it. One outside every root is shown whole. */
function shortPath(path: string, roots: readonly string[]): string {
  if (!isAbsolute(path)) return clip(path);

  for (const root of roots) {
    const fromRoot = relative(root, path);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) continue;

    const inRepo = fromRoot || ".";
    return clip(roots.length > 1 ? `${basename(root)}/${inRepo}` : inRepo);
  }
  return clip(path);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return clip(url);
  }
}
