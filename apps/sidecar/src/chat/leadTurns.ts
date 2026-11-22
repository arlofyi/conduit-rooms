import {
  REPLY_LOOKUPS,
  type LeadFailure,
  type LeadStatus,
  type Message,
  type Project,
  type ReplyStep,
  type WakeReason,
} from "@rooms/shared";
import type { Ledger } from "../ledger/ledger";
import { accessFor } from "../leads/access";
import type { AppTools } from "../leads/appTools";
import type { Briefs } from "../leads/briefs";
import { knowledgeOf } from "../leads/knowledge";
import type { Knowledge } from "../leads/prompts";
import {
  WakeFailedError,
  type LeadRuntime,
  type Wake,
  type WakeLimits,
} from "../leads/runtime";
import type { Db } from "../store/db";
import { logEvent } from "../store/events";
import {
  insertMessage,
  listMessages,
  listRecentMessages,
  saveStreamedReply,
  settleMessage,
} from "../store/messages";
import type { ConversationBus } from "./conversationBus";

/**
 * One speaker's turn in any conversation, whether the lead of a project or
 * of a product, or an agent you hired: gather what it knows, wake it, forward
 * its reply piece by piece, and settle the message.
 *
 * This is the part every kind of conversation shares. What differs between a
 * project room and a common room is only who gets a turn and when, and that
 * lives in directChatService.ts and channelService.ts.
 */
export interface LeadTurns {
  /** Runs one turn to its end. Resolves when the reply is settled, however it ended. */
  run(turn: Turn): Promise<void>;
  /** Stops whichever reply is being written in this conversation, keeping its text (R-UI-28). */
  stop(conversationId: string): void;
  status(conversationId: string, projectId: string): LeadStatus;
  /** The conversation's messages, with the reply in progress as it stands this instant. */
  messages(conversationId: string): Message[];
}

export interface Turn {
  conversationId: string;
  project: Project;
  reason: WakeReason;
  /** How many recent messages the lead is shown. */
  contextMessages: number;
  /** Builds the two prompts once what the speaker knows and the history are in hand. */
  prompts: (knowledge: Knowledge, history: Message[]) => { systemPrompt: string; prompt: string };
}

interface Deps {
  db: Db;
  ledger: Ledger;
  runtime: LeadRuntime;
  briefs: Briefs;
  appTools: AppTools;
  bus: ConversationBus;
}

const REPLY_LIMITS: WakeLimits = { effort: "quick", firstTextTimeoutMs: 30_000 };

/**
 * A hired agent and a product's lead may search the web or put a question to
 * another lead before they write a word, and that lead takes up to a minute.
 */
const ASKING_REPLY_LIMITS: WakeLimits = { effort: "quick", firstTextTimeoutMs: 180_000 };

/** How often a streaming reply is written to disk, so a crash loses at most this much. */
const SAVE_EVERY_MS = 750;

/** The reply being written in a conversation. Lead turns are sequential, so there is at most one. */
interface ActiveReply {
  wake: Wake;
  messageId: string;
  /** Disk lags these two by up to SAVE_EVERY_MS. */
  body: string;
  steps: ReplyStep[];
}

export function createLeadTurns({ db, ledger, runtime, briefs, appTools, bus }: Deps): LeadTurns {
  const active = new Map<string, ActiveReply>();
  const statuses = new Map<string, LeadStatus>();

  const statusKey = (conversationId: string, projectId: string) => `${conversationId}:${projectId}`;

  function setStatus(turn: Turn, status: LeadStatus, failure?: LeadFailure): void {
    statuses.set(statusKey(turn.conversationId, turn.project.id), status);
    bus.publish(turn.conversationId, { type: "lead.status", projectId: turn.project.id, status, failure });
  }

  /**
   * What the speaker knows as this turn starts, or null if that could not be
   * put together. A lead with no brief writes one first (R-LEAD-11), which
   * is the only part that can fail.
   */
  async function gatherKnowledge(turn: Turn): Promise<Knowledge | null> {
    const { project } = turn;

    if (briefs.isDue(project)) {
      setStatus(turn, "joining");
      try {
        const brief = await briefs.ensure(project, (progress) =>
          bus.publish(turn.conversationId, { type: "lead.joining", projectId: project.id, progress }),
        );
        logEvent(db, "brief_refreshed", turn.conversationId, { projectId: project.id, version: brief?.version });
      } catch (error) {
        const failure = briefFailure(error);
        logEvent(db, "brief_refresh_failed", turn.conversationId, { projectId: project.id, ...failure });
        postFailedReply(turn, failure);
        return null;
      }
    }

    return knowledgeOf(db, ledger, project);
  }

  /** With no brief the lead cannot join, so the failure stands in for its reply. */
  function postFailedReply(turn: Turn, failure: LeadFailure): void {
    const placeholder = insertMessage(db, {
      conversationId: turn.conversationId,
      authorKind: "lead",
      authorProjectId: turn.project.id,
      body: "",
      status: "streaming",
      wakeReason: turn.reason,
    });
    const message = settleMessage(db, placeholder.id, { status: "failed", body: "", failure });

    bus.publish(turn.conversationId, { type: "message.created", message });
    setStatus(turn, "error", failure);
  }

  async function streamReply(turn: Turn, knowledge: Knowledge): Promise<void> {
    const { conversationId, project } = turn;
    const history = listRecentMessages(db, conversationId, turn.contextMessages);

    // Filled in below, once the reply has an id. Tools that attach to the reply read it when they run.
    const replyBeingWritten = { conversationId, messageId: null as string | null };

    const wake = runtime.wake({
      project,
      reason: turn.reason,
      ...turn.prompts(knowledge, history),
      access: accessFor(db, project, REPLY_LOOKUPS),
      limits: project.kind === "project" ? REPLY_LIMITS : ASKING_REPLY_LIMITS,
      appTools: appTools.for(project, replyBeingWritten),
    });

    const reply = insertMessage(db, {
      conversationId,
      authorKind: "lead",
      authorProjectId: project.id,
      body: "",
      status: "streaming",
      wakeId: wake.id,
      wakeReason: turn.reason,
    });

    replyBeingWritten.messageId = reply.id;

    const current: ActiveReply = { wake, messageId: reply.id, body: "", steps: [] };
    const startedAt = Date.now();
    active.set(conversationId, current);

    bus.publish(conversationId, { type: "message.created", message: reply });
    setStatus(turn, "speaking");
    logEvent(db, "wake_started", conversationId, { wakeId: wake.id, reason: turn.reason, projectId: project.id });

    let lastSavedAt = Date.now();
    let outcome: Outcome = { status: "failed", failure: CUT_OFF };

    try {
      for await (const event of wake.events) {
        if (event.type === "step") {
          current.steps.push(event.step);
          bus.publish(conversationId, { type: "message.step", messageId: reply.id, step: event.step });
          continue;
        }
        if (event.type !== "text") {
          outcome = outcomeOf(event);
          continue;
        }

        bus.publish(conversationId, {
          type: "message.delta",
          messageId: reply.id,
          offset: current.body.length,
          text: event.text,
        });
        current.body += event.text;

        if (Date.now() - lastSavedAt >= SAVE_EVERY_MS) {
          saveStreamedReply(db, reply.id, current.body, current.steps);
          lastSavedAt = Date.now();
        }
      }
    } catch {
      outcome = { status: "failed", failure: CUT_OFF };
    } finally {
      active.delete(conversationId);
    }

    const settled = settleMessage(db, reply.id, {
      ...outcome,
      body: current.body,
      steps: current.steps,
      tookMs: Date.now() - startedAt,
    });
    bus.publish(conversationId, { type: "message.settled", message: settled });
    logEvent(db, WAKE_EVENT[outcome.status], conversationId, { wakeId: wake.id, ...outcome.failure });

    if (outcome.status === "failed") setStatus(turn, "error", outcome.failure);
    else setStatus(turn, "listening");
  }

  return {
    async run(turn) {
      const knowledge = await gatherKnowledge(turn);
      if (knowledge) await streamReply(turn, knowledge);
    },

    stop(conversationId) {
      active.get(conversationId)?.wake.stop();
    },

    status(conversationId, projectId) {
      return statuses.get(statusKey(conversationId, projectId)) ?? "listening";
    },

    messages(conversationId) {
      const stored = listMessages(db, conversationId);
      const current = active.get(conversationId);
      if (!current) return stored;

      return stored.map((message) =>
        message.id === current.messageId ? { ...message, body: current.body, steps: current.steps } : message,
      );
    },
  };
}

type Outcome =
  | { status: "complete"; failure?: undefined }
  | { status: "stopped"; failure?: undefined }
  | { status: "failed"; failure: LeadFailure };

const WAKE_EVENT = {
  complete: "wake_finished",
  stopped: "wake_stopped",
  failed: "wake_failed",
} as const;

const CUT_OFF: LeadFailure = {
  code: "runtime_error",
  message: "The lead's reply was cut off.",
};

function outcomeOf(
  event: { type: "finished" } | { type: "stopped" } | { type: "failed"; failure: LeadFailure },
): Outcome {
  switch (event.type) {
    case "finished":
      return { status: "complete" };
    case "stopped":
      return { status: "stopped" };
    case "failed":
      return { status: "failed", failure: event.failure };
  }
}

function briefFailure(error: unknown): LeadFailure {
  // An auth problem is the same problem whether it surfaced in a brief or a reply.
  if (error instanceof WakeFailedError && error.failure.code === "auth_required") {
    return error.failure;
  }
  return { code: "brief_failed", message: "The lead could not read the project to write its brief." };
}
