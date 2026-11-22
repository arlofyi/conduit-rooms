/**
 * The steps a speaker takes on the way to a reply: each file it read, each
 * search it ran. They are shown as it works and kept with the finished
 * message, so you can see what an answer was made from.
 */

export type StepKind =
  | "read"
  | "find"
  | "search"
  | "web_search"
  | "web_page"
  // Steps taken in Rooms itself, with the app's own tools.
  | "ask"
  | "queue_briefs"
  | "read_brief"
  | "sessions"
  | "artifact"
  | "start_session"
  | "other";

export interface ReplyStep {
  kind: StepKind;
  /**
   * What it was done to: a path from the repo's root, a search pattern, a
   * query, a site, a lead's handle, "9 projects", a tool's name.
   */
  subject: string;
  /** For a search inside a repo: the folder it was limited to. */
  where?: string;
  /** For a session that was started: the name it was given, which is how it is found again. */
  label?: string;
}

/** How many lookups one reply may make before it has to answer with what it has (R-LEAD-16). */
export const REPLY_LOOKUPS = 8;

const VERBS: Record<StepKind, { doing: string; done: string }> = {
  read: { doing: "Reading", done: "Read" },
  find: { doing: "Looking for", done: "Looked for" },
  search: { doing: "Searching for", done: "Searched for" },
  web_search: { doing: "Searching the web for", done: "Searched the web for" },
  web_page: { doing: "Reading", done: "Read" },
  ask: { doing: "Asking", done: "Asked" },
  queue_briefs: { doing: "Starting briefs for", done: "Started briefs for" },
  read_brief: { doing: "Reading the brief of", done: "Read the brief of" },
  sessions: { doing: "Checking sessions in", done: "Checked sessions in" },
  artifact: { doing: "Writing", done: "Wrote" },
  start_session: { doing: "Starting a session in", done: "Started a session in" },
  other: { doing: "Using", done: "Used" },
};

const QUOTED: ReadonlySet<StepKind> = new Set(["search", "web_search"]);

/** A step in words: "Reading src/main.ts" while it happens, "Read src/main.ts" once it has. */
export function describeStep(step: ReplyStep, tense: "doing" | "done"): string {
  const subject = QUOTED.has(step.kind) ? `"${step.subject}"` : step.subject;
  const where = step.where ? ` in ${step.where}` : "";
  return `${VERBS[step.kind][tense]} ${subject}${where}`;
}

/**
 * All of a reply's steps in one line: "Searched twice, read 3 files".
 * Null when there were none, which is for the caller to put into words.
 */
export function summariseSteps(steps: readonly ReplyStep[]): string | null {
  const count = (...kinds: StepKind[]) => steps.filter((step) => kinds.includes(step.kind)).length;

  const searches = count("search", "find", "web_search");
  const files = count("read");
  const pages = count("web_page");
  const asked = count("ask");
  const briefs = count("read_brief");
  const others = count("other");

  const parts = [
    asked > 0 && `asked ${plural(asked, "lead")}`,
    searches > 0 && `searched ${times(searches)}`,
    files > 0 && `read ${plural(files, "file")}`,
    pages > 0 && `read ${plural(pages, "page")}`,
    briefs > 0 && `read ${plural(briefs, "brief")}`,
    count("sessions") > 0 && "checked sessions",
    count("queue_briefs") > 0 && "started briefs",
    count("artifact") > 0 && `wrote ${plural(count("artifact"), "artifact")}`,
    count("start_session") > 0 && `started ${plural(count("start_session"), "session")}`,
    others > 0 && `used ${plural(others, "other tool")}`,
  ].filter((part) => part !== false);

  if (parts.length === 0) return null;

  const line = parts.join(", ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function times(n: number): string {
  if (n === 1) return "once";
  return n === 2 ? "twice" : `${n} times`;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
