import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SessionTranscript, TranscriptItem } from "@rooms/shared";

/**
 * A session's conversation, read from the transcript Claude Code writes as it
 * works: one JSON record per line, in ~/.claude/projects/<folder>/<id>.jsonl.
 * Nothing is generated or summarised by a model here. It is a reader over a file.
 *
 * Rooms only ever reads these files.
 */

/**
 * Transcripts grow without limit (tens of megabytes is normal), and a single
 * record can be large when it carries an image. Only this much of the end is read.
 */
const TAIL_BYTES = 4 * 1024 * 1024;

const TOOL_SUMMARY_MAX = 140;

function claudeProjectsDir(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  return join(configDir || join(homedir(), ".claude"), "projects");
}

/** Where each conversation's file was found, so the folders are searched once per conversation. */
const knownPaths = new Map<string, string>();

/**
 * Finds a conversation's file. Claude names the folder after the working
 * directory the session ran in, which Rooms cannot always know (worktrees,
 * other accounts), so every folder is checked for the file instead.
 */
async function findTranscript(conversationId: string): Promise<string | null> {
  const known = knownPaths.get(conversationId);
  if (known) return known;

  const root = claudeProjectsDir();
  const folders = await readdir(root).catch(() => [] as string[]);

  for (const folder of folders) {
    const path = join(root, folder, `${conversationId}.jsonl`);
    const found = await stat(path).then((entry) => entry.isFile()).catch(() => false);

    if (found) {
      knownPaths.set(conversationId, path);
      return path;
    }
  }
  return null;
}

/** The last result per file, with the size and time it was read at. An open view polls, and most polls find nothing new. */
const lastRead = new Map<string, { size: number; mtimeMs: number; transcript: SessionTranscript }>();

export async function readTranscript(conversationId: string): Promise<SessionTranscript> {
  const path = await findTranscript(conversationId);
  if (!path) return { items: [], truncated: false, unavailable: "no_transcript" };

  const { size, mtimeMs } = await stat(path);
  const cached = lastRead.get(path);
  if (cached && cached.size === size && cached.mtimeMs === mtimeMs) return cached.transcript;

  const transcript = await parseTranscript(path);
  lastRead.set(path, { size, mtimeMs, transcript });
  return transcript;
}

async function parseTranscript(path: string): Promise<SessionTranscript> {
  const { text, truncated } = await readTail(path);
  const lines = text.split("\n");

  // A tail starts mid-line more often than not. That first fragment is not a whole record.
  if (truncated) lines.shift();

  return { items: lines.flatMap(itemsOf), truncated, unavailable: null };
}

async function readTail(path: string): Promise<{ text: string; truncated: boolean }> {
  const file = await open(path, "r");
  try {
    const { size } = await file.stat();
    const start = Math.max(0, size - TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);

    await file.read(buffer, 0, buffer.length, start);
    return { text: buffer.toString("utf8"), truncated: start > 0 };
  } finally {
    await file.close();
  }
}

// ---- One record to the items it shows ----

interface TranscriptRecord {
  type?: string;
  uuid?: string;
  timestamp?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  /** Set on the summary Claude writes when a conversation outgrows its context and is compacted. */
  isCompactSummary?: boolean;
  origin?: { kind?: string };
  message?: { content?: unknown };
  /** On the record that carries a tool's result. For a question put to the person, it holds their answers. */
  toolUseResult?: unknown;
}

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

const COMPACTED_NOTE = "The conversation got long, so Claude summarised everything above this line and carried on.";
const STOPPED_NOTE = "You stopped Claude here.";

/** Exported for tests. */
export function itemsOf(line: string): TranscriptItem[] {
  const record = parse(line);

  // A sidechain is a subagent's own conversation. It is not part of this one.
  if (!record?.uuid || record.isSidechain) return [];

  const at = record.timestamp ?? null;
  const note = (text: string): TranscriptItem[] => [{ id: record.uuid!, kind: "note", text, at }];

  // The summary is written for Claude, runs to pages, and arrives as if you had typed it. Show that it happened.
  if (record.isCompactSummary) return note(COMPACTED_NOTE);

  const blocks = contentBlocks(record.message?.content);

  if (record.type === "user") {
    const answers = answersIn(record.toolUseResult);
    if (answers) return [{ id: record.uuid, kind: "user", text: answers, at }];

    const text = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim();

    if (text.startsWith("[Request interrupted by user")) return note(STOPPED_NOTE);
    if (!isTypedByPerson(record, text)) return [];

    const images = blocks.filter((block) => block.type === "image").length;
    return [{ id: record.uuid, kind: "user", text, at, ...(images > 0 && { images }) }];
  }

  if (record.type === "assistant") {
    return blocks.flatMap((block, index): TranscriptItem[] => {
      const id = `${record.uuid}:${index}`;

      if (block.type === "text" && block.text?.trim()) {
        return [{ id, kind: "assistant", text: block.text, at }];
      }
      if (block.type === "tool_use" && block.name) {
        return [toolItem(id, at, block.name, block.input ?? {})];
      }
      return [];
    });
  }

  return [];
}

function parse(line: string): TranscriptRecord | null {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line) as TranscriptRecord;
  } catch {
    return null;
  }
}

/** A message's content is either a plain string or a list of typed blocks. */
function contentBlocks(content: unknown): ContentBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

/**
 * Most "user" records are not from a person: tool results, hook output and
 * injected reminders all arrive under that type. Claude marks the real ones
 * with origin "human". For older records without the mark, text wrapped in
 * a tag (<system-reminder>, <command-name>) is taken to be machinery.
 */
function isTypedByPerson(record: TranscriptRecord, text: string): boolean {
  if (text.length === 0 || record.isMeta) return false;
  if (record.origin?.kind) return record.origin.kind === "human";
  return !text.startsWith("<");
}

/**
 * What you chose when Claude put a question to you. That choice is something
 * you said, but Claude records it as a tool's result, where it would otherwise
 * never be shown. One question gives the answer alone. Several give each with its question.
 */
function answersIn(toolUseResult: unknown): string | null {
  const answers = (toolUseResult as { answers?: unknown } | null)?.answers;
  if (!answers || typeof answers !== "object") return null;

  const given = Object.entries(answers as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
  );
  if (given.length === 0) return null;
  if (given.length === 1) return given[0]![1];

  return given.map(([question, answer]) => `- ${question} **${answer}**`).join("\n");
}

// ---- One tool call to a line ----

function toolItem(id: string, at: string | null, name: string, input: Record<string, unknown>): TranscriptItem {
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  const line = (tool: string, detail: string): TranscriptItem => ({
    id,
    kind: "tool",
    tool,
    text: detail ? oneLine(detail) : tool,
    at,
  });

  switch (name) {
    case "Bash":
      // Claude says what each command is for. That reads better than the command, which is often a script.
      return line("Bash", text("description") || text("command"));
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return line(name, homeRelative(text("file_path") || text("notebook_path")));
    case "Glob":
    case "Grep":
      return line(name, text("pattern"));
    case "WebSearch":
      return line("Web search", text("query"));
    case "WebFetch":
      return line("Web page", text("url"));
    case "Agent":
    case "Task":
      return line("Subagent", text("description"));
    case "Skill":
      return line("Skill", text("skill"));
    case "AskUserQuestion":
      return line("Asked you", firstQuestion(input));
    default:
      return name.startsWith("mcp__") ? connectorItem(line, name, input) : line(name, firstText(input));
  }
}

/** "mcp__claude-in-chrome__browser_batch" is the tool "browser batch" of the connector "claude-in-chrome". */
function connectorItem(
  line: (tool: string, detail: string) => TranscriptItem,
  name: string,
  input: Record<string, unknown>,
): TranscriptItem {
  const [, server = "", ...rest] = name.split("__");
  const connector = server.replace(/^claude_ai_/, "").replace(/^plugin_[^_]+_/, "").replace(/_/g, " ");
  const action = rest.join(" ").replace(/[_-]/g, " ");

  const detail = firstText(input);
  return line(connector, detail ? `${action}: ${detail}` : action);
}

function firstQuestion(input: Record<string, unknown>): string {
  const [first] = Array.isArray(input.questions) ? (input.questions as Array<{ question?: unknown }>) : [];
  return typeof first?.question === "string" ? first.question : "";
}

/** The one input that says what a call did, for a tool this file has no special wording for. */
function firstText(input: Record<string, unknown>): string {
  const value = ["description", "query", "url", "file_path", "command", "pattern", "prompt", "text", "id"]
    .map((key) => input[key])
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  return value ?? "";
}

function homeRelative(path: string): string {
  const home = homedir();
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

function oneLine(detail: string): string {
  const flat = detail.replace(/\s+/g, " ").trim();
  return flat.length > TOOL_SUMMARY_MAX ? `${flat.slice(0, TOOL_SUMMARY_MAX)}...` : flat;
}
