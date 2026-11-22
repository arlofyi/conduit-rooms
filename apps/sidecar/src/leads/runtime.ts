import type { LeadFailure, Project, ReplyStep, WakeReason } from "@rooms/shared";

/**
 * The lead runtime: the one seam between Rooms and whatever runs the model.
 *
 * A lead is a role, not a process. Each wake starts a fresh session, hands it
 * a prompt, streams one answer and ends. Nothing carries over to the next
 * wake except what is in the ledger (R-LEAD-01).
 *
 * v0 implements this over the Claude Agent SDK (agentSdkRuntime.ts). Tests
 * use a scripted fake. The gate and the clerk join this interface in M3 and M4.
 */
export interface LeadRuntime {
  wake(request: WakeRequest): Wake;
}

export interface WakeRequest {
  project: Project;
  reason: WakeReason;
  /** Who the lead is, what it may do, and its brief. */
  systemPrompt: string;
  /** The conversation, and what is expected of this wake. */
  prompt: string;
  /** What this wake may touch. Enforced by the tools it is given, never by the prompt alone (R-LEAD-15). */
  access: WakeAccess;
  limits: WakeLimits;
  /** Tools for Rooms itself, beyond what `access` gives. Left out, the wake has none. */
  appTools?: readonly AppTool[];
}

/**
 * One thing a speaker can do in Rooms itself: ask a lead, read a brief.
 * Written without reference to what runs the model, so the runtime is the
 * only place that knows how a tool is offered to it.
 */
export interface AppTool {
  name: string;
  /** Read by the model to decide when to use it. */
  description: string;
  /** The fields it takes, as a zod shape. */
  input: Record<string, import("zod").ZodType>;
  /** The step a call to it is, for showing with the reply. */
  step(input: Record<string, unknown>): ReplyStep;
  /** Does it, and returns what the speaker is told. */
  run(input: Record<string, unknown>): Promise<string>;
}

/** How many calls to app tools one wake may make. */
export const APP_TOOL_CALLS = 6;

/**
 * The only things a wake can reach. A project's lead reads its own repo, a
 * product's lead reads the repos under it, and a hired agent has no repo and
 * may use the web. None of them can write a file or run a command.
 */
export type WakeAccess =
  | {
      kind: "repo";
      /** The folders it may read. The wake runs in the first, so a relative path means that one. */
      roots: RepoRoots;
      /** Reads allowed before it must answer (R-LEAD-16). */
      maxReads: number;
    }
  | { kind: "web"; /** Searches and page fetches allowed before it must answer. */ maxCalls: number };

/** At least one folder. */
export type RepoRoots = readonly [string, ...string[]];

/** For a wake that only has to write from what it was handed: no files, no web. */
export const NO_ACCESS: WakeAccess = { kind: "web", maxCalls: 0 };

/** How hard the lead thinks. Someone is waiting on "quick". Nobody is waiting on "thorough". */
export type WakeEffort = "quick" | "thorough";

export interface WakeLimits {
  effort: WakeEffort;
  /** Give up if no text has arrived by then. Null for background wakes with no one waiting. */
  firstTextTimeoutMs: number | null;
}

export interface Wake {
  id: string;
  /** Ends after exactly one of: finished, stopped, failed. */
  events: AsyncIterable<WakeEvent>;
  /** Ends the wake early. The text streamed so far is kept by the caller. */
  stop(): void;
}

export type WakeEvent =
  | { type: "text"; text: string }
  /** The wake has just decided to look something up: read a file, run a search. */
  | { type: "step"; step: ReplyStep }
  | { type: "finished" }
  | { type: "stopped" }
  | { type: "failed"; failure: LeadFailure };

/** Told of each step a wake takes, as it takes it. */
export type OnStep = (step: ReplyStep) => void;

/**
 * Runs a wake to its end and returns everything it wrote. For wakes whose
 * text nobody reads as it arrives. Its steps can still be watched.
 */
export async function collectText(wake: Wake, onStep?: OnStep): Promise<string> {
  let text = "";

  for await (const event of wake.events) {
    if (event.type === "text") text += event.text;
    if (event.type === "step") onStep?.(event.step);
    if (event.type === "failed") throw new WakeFailedError(event.failure);
    if (event.type === "stopped") throw new WakeFailedError(STOPPED_FAILURE);
  }

  return text;
}

const STOPPED_FAILURE: LeadFailure = {
  code: "runtime_error",
  message: "The lead was stopped before it finished.",
};

export class WakeFailedError extends Error {
  constructor(readonly failure: LeadFailure) {
    super(failure.message);
    this.name = "WakeFailedError";
  }
}
