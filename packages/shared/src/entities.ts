/**
 * The records Rooms stores and passes around. Field names follow
 * specs/10-data-model.md, in camelCase. Timestamps are ISO 8601 strings.
 */

import type { ReplyStep } from "./steps";

/**
 * Anyone you can talk to. There are three kinds:
 *
 *   project  one of Conduit's projects, which is one repo. Answered by its lead, which reads that repo.
 *   product  several repos you grouped under one name ("Arlo" over arlo, arlo-desktop and
 *            arlo-memory). Answered by a product lead, which reads all of them. Each repo
 *            keeps its own lead, and you can tag it from the product's room.
 *   hired    an agent you made (a CTO, a strategist, a researcher). It belongs to no
 *            project, knows every project through its brief, and can use the web.
 *
 * All three have a room of their own, can be put in common rooms, tagged with
 * their handle and picked by the gate from their persona. That is why they
 * share one type and one handle namespace. The name `Project` is from before
 * the other two existed.
 */
export interface Project {
  /** Conduit's project id, or an id Rooms minted for a product or a hired agent. */
  id: string;
  kind: ParticipantKind;
  handle: string;
  displayName: string;
  /** The repo a project's lead can read. Null for a product and for a hired agent. */
  repoPath: string | null;
  /** For a project: the product you put it under, if any. Null for everything else. */
  productId: string | null;
  /** Hex color from Conduit, or one derived from the id. */
  color: string;
}

export type ParticipantKind = "project" | "product" | "hired";

export const PRODUCT_NAME_MAX_LENGTH = 40;

/** What you wrote when you hired an agent: who it is and how it should work. */
export interface HiredAgent {
  projectId: string;
  instructions: string;
  hiredAt: string;
}

export const AGENT_NAME_MAX_LENGTH = 40;
export const AGENT_BRIEFING_MAX_LENGTH = 1_000;
export const AGENT_INSTRUCTIONS_MAX_LENGTH = 6_000;

/**
 * A project room: your private line to one project's lead. The spec calls it
 * a direct chat and the code keeps that name. On screen it is a "project room".
 */
export interface DirectChat {
  id: string;
  projectId: string;
  /** When you added this room to the sidebar. Null for a project whose room you have not added. */
  addedAt: string | null;
  /** Null until the first message is sent. */
  lastActivityAt: string | null;
  /** What the lead is doing in this chat right now. Live state, never stored. */
  leadStatus: LeadStatus;
}

/**
 * A common room: a permanent shared channel, as in Slack. You create it,
 * name it, and choose which projects' leads are in it. It is never closed.
 */
export interface Room {
  id: string;
  /** Shown after "#". Same character rules as a project handle. */
  name: string;
  /** The leads you put in this room, in the order you added them. */
  members: RoomMember[];
  createdAt: string;
}

export interface RoomMember {
  projectId: string;
  /** What this lead is doing in this room right now. Live state, never stored. */
  leadStatus: LeadStatus;
}

export type AuthorKind = "user" | "lead" | "system";

export type MessageStatus = "streaming" | "complete" | "stopped" | "failed";

/** Why a lead was woken. Every wake has exactly one reason (specs/08-leads.md). */
export type WakeReason =
  | "direct"
  | "addressed"
  | "flag_tapped"
  | "gate_speak"
  | "addressed_by_lead"
  | "ratify"
  | "handoff"
  | "refresh_brief";

export type SystemKind =
  | "joined"
  | "join_failed"
  | "untagged_hint"
  | "paused"
  | "closing"
  | "back_to_discussion"
  | "decided"
  | "closed"
  | "note_saved"
  | "handoff_sent"
  | "continued_from";

export interface Message {
  id: string;
  /** A direct chat id today, a room id from M2. */
  conversationId: string;
  authorKind: AuthorKind;
  /** Set only when a lead wrote the message. */
  authorProjectId: string | null;
  body: string;
  mentions: string[];
  status: MessageStatus;
  wakeId: string | null;
  wakeReason: WakeReason | null;
  systemKind: SystemKind | null;
  /** Why a failed message failed, in words fit for the screen. */
  failure: LeadFailure | null;
  /**
   * What a lead looked up on the way to this reply, in order. Empty when it
   * answered from what it already knew. Null for your messages, for system
   * rows, and for replies from before steps were kept.
   */
  steps: ReplyStep[] | null;
  /** How long a lead's reply took from being woken to its last word, in milliseconds. Null where `steps` is. */
  tookMs: number | null;
  createdAt: string;
  editedAt: string | null;
}

export type LeadFailureCode =
  | "auth_required"
  | "timed_out"
  | "brief_failed"
  | "runtime_error";

export interface LeadFailure {
  code: LeadFailureCode;
  message: string;
}

export interface Brief {
  projectId: string;
  version: number;
  body: string;
  writtenAt: string;
  writtenBy: "lead" | "user";
}

/**
 * A project agent's persona: a few lines saying what this agent is and what
 * to ask it about, in the words a person would use. The gate reads it to
 * decide whether an untagged message is for this agent. It is written for
 * that one job, which the brief is not: the brief is the lead's own memory.
 */
export interface Persona {
  projectId: string;
  version: number;
  body: string;
  writtenAt: string;
  writtenBy: "lead" | "user";
}

export const PERSONA_MAX_LENGTH = 1_500;

/**
 * A page an agent wrote for you to look at: a comparison, a diagram, a plan,
 * a mock-up. It belongs to the reply it was written with, and opens in a
 * panel inside the app. It is a whole HTML document, drawn in a sealed frame
 * that cannot reach the app, your files or the network.
 */
export interface Artifact {
  id: string;
  conversationId: string;
  /** The reply it came with. */
  messageId: string;
  /** Who wrote it. */
  projectId: string;
  title: string;
  html: string;
  createdAt: string;
}

/** An artifact without its page, for listing. */
export type ArtifactRef = Omit<Artifact, "html">;

export const ARTIFACT_TITLE_MAX_LENGTH = 80;
/** Room for a full page with its styles and a script or two, and no more. */
export const ARTIFACT_MAX_LENGTH = 400_000;

/** One repo under a product while the product's lead reads them all for the first time. */
export interface RepoProgress {
  handle: string;
  state: "waiting" | "reading" | "done" | "failed";
  /** What is being done in it right now: "Reading package.json". */
  doing: string | null;
}

/**
 * How far a lead has got with joining: writing its first brief. A project's
 * lead reads one repo, so `repos` is empty and `doing` says it all. A
 * product's lead reads several side by side, and `repos` has each of them.
 */
export interface JoinProgress {
  doing: string | null;
  repos: RepoProgress[];
}

/** The one status word shown beside a lead (specs/04-interface.md). */
export type LeadStatus = "listening" | "joining" | "speaking" | "error";

export interface Draft {
  conversationId: string;
  body: string;
  updatedAt: string;
}

/** What the app restores on launch (R-UI-12). */
export interface UiState {
  /** The view that was open, as encoded by the desktop app. Opaque to the sidecar. */
  lastView: string | null;
}

// ---- What Conduit is doing (read from Conduit, never stored by Rooms) ----

export type SessionStatus = "working" | "needs_you" | "done" | "idle" | "stopped";

/** One of Conduit's agent sessions in a project. */
export interface ProjectSession {
  id: string;
  name: string;
  /** Which agent runs it: "claude", "conduitcode" and so on. */
  agent: string;
  role: "worker" | "conductor";
  status: SessionStatus;
  /** Set when the session works in its own git worktree. */
  branch: string | null;
}

export type ProjectStatus = "working" | "needs_you" | "idle";

export interface ProjectActivity {
  projectId: string;
  status: ProjectStatus;
  sessions: ProjectSession[];
}

// ---- Looking inside a session (read from Claude's transcript and Conduit's tmux) ----

/** One entry in a session's conversation, as its agent recorded it. */
export interface TranscriptItem {
  id: string;
  /**
   * "user" is something a person typed or chose. "assistant" is what the agent
   * wrote. "tool" is one tool call, summarised to a line. "note" is something
   * that happened to the conversation itself: it was summarised, or stopped.
   */
  kind: "user" | "assistant" | "tool" | "note";
  text: string;
  at: string | null;
  /** For a tool call: the tool's name as a person would say it, "Bash" or "Notion". */
  tool?: string;
  /** For a message from a person: how many pictures came with it. */
  images?: number;
}

/** Why a session's chat cannot be shown. */
export type TranscriptUnavailable = "not_claude" | "no_transcript";

export interface SessionTranscript {
  items: TranscriptItem[];
  /** True when the conversation is long and only its most recent part was read. */
  truncated: boolean;
  /** Set, with no items, when there is nothing to show. */
  unavailable: TranscriptUnavailable | null;
}

/** A snapshot of a session's terminal screen. Looking at it never touches the session. */
export interface SessionTerminal {
  /** False when the session has no live terminal in Conduit. */
  running: boolean;
  cols: number;
  rows: number;
  /** Where the cursor is on the visible screen, from its top left corner. */
  cursor: { x: number; y: number };
  /** Recent scrollback followed by the visible screen, as terminal output, colors included. */
  screen: string;
}
