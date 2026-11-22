import type { LeadStatus, Message, Project } from "@rooms/shared";
import { directChatPrompt, directChatSystemPrompt } from "../leads/prompts";
import type { Db } from "../store/db";
import { touchDirectChat, type StoredDirectChat as DirectChat } from "../store/directChats";
import { saveDraft } from "../store/drafts";
import { logEvent } from "../store/events";
import { deleteMessage, getMessage, insertMessage } from "../store/messages";
import type { ConversationBus } from "./conversationBus";
import type { LeadTurns, Turn } from "./leadTurns";

/**
 * Project rooms: you send a message, the project's lead answers (R-DM-03).
 *
 * The path of one message:
 *
 *   send()             store your message, announce it, mark the room as owing a reply
 *   runPendingTurns()  one lead turn at a time per room (R-DM-04)
 *   turns.run()        make sure a brief exists, wake the lead, stream its reply (leadTurns.ts)
 */
export interface DirectChatService {
  send(chat: DirectChat, project: Project, body: string): Message;
  /** Stops the reply in progress, keeping what was written (R-UI-28). */
  stop(chat: DirectChat): void;
  /**
   * Has a message answered again. A lead's reply, failed or not, is dropped
   * and written afresh (R-UI-30). For a message of yours the lead simply
   * answers once more. Either way it answers the conversation as it now stands.
   */
  rerun(chat: DirectChat, project: Project, messageId: string): void;
  leadStatus(chat: DirectChat): LeadStatus;
  /** The room's messages, with the reply in progress as it stands this instant. */
  messages(chat: DirectChat): Message[];
}

interface Deps {
  db: Db;
  bus: ConversationBus;
  turns: LeadTurns;
}

/** A lead sees its brief plus this many recent messages, and nothing older (R-DM-16). */
const CONTEXT_MESSAGES = 40;

/** What the service remembers about a room while the app is running. Never stored. */
interface RoomState {
  /** True when you have said something the lead has not yet answered. */
  owesReply: boolean;
  running: boolean;
}

export function createDirectChatService({ db, bus, turns }: Deps): DirectChatService {
  const states = new Map<string, RoomState>();

  function stateOf(chat: DirectChat): RoomState {
    let state = states.get(chat.id);
    if (!state) {
      state = { owesReply: false, running: false };
      states.set(chat.id, state);
    }
    return state;
  }

  function turnFor(chat: DirectChat, project: Project): Turn {
    return {
      conversationId: chat.id,
      project,
      reason: "direct",
      contextMessages: CONTEXT_MESSAGES,
      prompts: (knowledge, history) => ({
        systemPrompt: directChatSystemPrompt(project, knowledge),
        prompt: directChatPrompt(project, history),
      }),
    };
  }

  /** Runs lead turns until the lead owes nothing. Several quick messages get one reply, not one each. */
  async function runPendingTurns(chat: DirectChat, project: Project): Promise<void> {
    const state = stateOf(chat);
    if (state.running) return;

    state.running = true;
    try {
      while (state.owesReply) {
        state.owesReply = false;
        await turns.run(turnFor(chat, project));
        touchDirectChat(db, chat.id, new Date().toISOString());
      }
    } finally {
      state.running = false;
    }
  }

  function requestReply(chat: DirectChat, project: Project): void {
    stateOf(chat).owesReply = true;
    void runPendingTurns(chat, project);
  }

  return {
    send(chat, project, body) {
      const message = insertMessage(db, {
        conversationId: chat.id,
        authorKind: "user",
        body,
        status: "complete",
      });

      touchDirectChat(db, chat.id, message.createdAt);
      saveDraft(db, chat.id, "");
      logEvent(db, "message_sent", chat.id, { messageId: message.id });
      bus.publish(chat.id, { type: "message.created", message });

      requestReply(chat, project);
      return message;
    },

    stop(chat) {
      turns.stop(chat.id);
    },

    rerun(chat, project, messageId) {
      const message = getMessage(db, messageId);
      if (message?.conversationId !== chat.id || message.status === "streaming") return;

      if (message.authorKind === "lead") {
        deleteMessage(db, message.id);
        bus.publish(chat.id, { type: "message.removed", messageId: message.id });
      } else if (message.authorKind !== "user") {
        return;
      }

      requestReply(chat, project);
    },

    leadStatus(chat) {
      return turns.status(chat.id, chat.projectId);
    },

    messages(chat) {
      return turns.messages(chat.id);
    },
  };
}
