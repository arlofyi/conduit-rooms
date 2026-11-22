import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { promisify } from "node:util";
import type { Brief, Project } from "@rooms/shared";
import type { Ledger } from "../ledger/ledger";
import { briefPrompt, briefSystemPrompt, type RepoFacts } from "./prompts";
import { collectText, type LeadRuntime, type OnStep } from "./runtime";

const run = promisify(execFile);

/** A first brief reads far more than a conversation wake does, and nobody is watching it stream. */
export const BRIEF_LIMITS = { effort: "thorough", firstTextTimeoutMs: null } as const;
const BRIEF_READS = 30;

const COMMITS_SHOWN = 15;
const IGNORED_ENTRIES = new Set([".git", "node_modules", ".DS_Store"]);

/**
 * Writes a project's first brief (R-LEAD-11).
 *
 * The listing and the commit log are gathered here, in plain code, and handed
 * to the lead. That keeps the lead's tools to reads alone: it never needs a
 * shell just to learn what `git log` says.
 */
export async function writeFirstBrief(
  project: Project,
  runtime: LeadRuntime,
  ledger: Ledger,
  onStep?: OnStep,
): Promise<Brief> {
  // Only a project has a repo to write this from. A product's brief is written from its repos' briefs (briefs.ts).
  if (!project.repoPath) throw new Error(`${project.handle} has no repo of its own.`);

  const facts = await gatherRepoFacts(project.repoPath);

  const wake = runtime.wake({
    project,
    reason: "refresh_brief",
    systemPrompt: briefSystemPrompt(project),
    prompt: briefPrompt(project, facts),
    access: { kind: "repo", roots: [project.repoPath], maxReads: BRIEF_READS },
    limits: BRIEF_LIMITS,
  });

  const body = cleanBrief(await collectText(wake, onStep));
  return ledger.writeBrief(project.id, body, "lead");
}

async function gatherRepoFacts(repoPath: string): Promise<RepoFacts> {
  const [topLevel, recentCommits] = await Promise.all([
    listTopLevel(repoPath),
    listRecentCommits(repoPath),
  ]);
  return { topLevel, recentCommits };
}

async function listTopLevel(repoPath: string): Promise<string[]> {
  const entries = await readdir(repoPath, { withFileTypes: true });

  return entries
    .filter((entry) => !IGNORED_ENTRIES.has(entry.name))
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .sort();
}

/** An empty list for a repo with no commits, or a folder that is not a repo at all. */
async function listRecentCommits(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await run(
      "git",
      ["log", `--max-count=${COMMITS_SHOWN}`, "--pretty=format:%ad %s", "--date=short"],
      { cwd: repoPath },
    );
    return stdout.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/** Drops anything the model put before the title, and a code fence if it wrapped the brief in one. */
export function cleanBrief(text: string): string {
  const unfenced = text.trim().replace(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/, "$1");
  const titleStart = unfenced.search(/^# /m);

  if (titleStart === -1) {
    throw new Error("The lead did not return a brief in the expected format.");
  }
  return unfenced.slice(titleStart).trim();
}
