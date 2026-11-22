import {
  findMentions,
  MENTION_ALL,
  type LeadStatus,
  type Message,
  type Project,
} from "@rooms/shared";
import type { Ledger } from "../ledger/ledger";
import type { Gate, GateDecision } from "../leads/gate";
import type { Personas } from "../leads/personas";
import { channelPrompt, channelSystemPrompt, type ChannelWake } from "../leads/prompts";
import type { Db } from "../store/db";
import { saveDraft } from "../store/drafts";
import { logEvent } from "../store/events";
import { deleteMessage, getMessage, insertMessage, listRecentMessages } from "../store/messages";
import type { StoredRoom } from "../store/rooms";
import type { ConversationBus } from "./conversationBus";
import type { LeadTurns, Turn } from "./leadTurns";

/**
 * Common rooms: one shared conversation, several leads. Who replies to a
 * message is decided here, before any lead is woken (principle P2):
 *
 *   you tagged someone   "@conduit": those leads reply, and nobody else. "@all" is everyone.
 *   you named someone    "Conduit, are you busy?": that lead replies. No "@" needed.
 *   you said "you"       right after a lead spoke: "is anything pending on you?" is
 *                        for the lead you were just talking to.
 *   none of those        the gate, a classifier, is asked who in the room the message
 *                        is for. "why does the terminal flicker?" reaches the lead
 *                        whose persona covers terminals. "thanks" reaches nobody.
 *
 * The first three are plain string checks and never involve a model. Whether a
 * message contains a name is not a judgement call, and a model asked to make
 * it will sometimes read "conduit" inside "conduit-rooms".
 *
 * A product's own room is the same machinery with a host. You tag a repo's
 * lead to hear from it, and everything else is answered by the host, the
 * product's lead. Names and the gate play no part there: a product is often
 * named after one of its repos, and "arlo" should not wake two leads.
 *
 * The path of one message:
 *
 *   send()        store your message, then decide who replies
 *   (in send)     tags, else names, else "you", else one call to the gate
 *   enqueue()     turns run one at a time, so each lead reads the reply before it
 *   turns.run()   make sure a brief exists, wake the lead, stream its reply (leadTurns.ts)
 */
export interface ChannelService {
  /**
   * `members` are the speakers in this room. Only they can reply in it.
   * `host`, one of them, answers whatever is not tagged for someone else.
   */
  send(room: RoomRef, members: Project[], body: string, host?: Project): Message;
  stop(room: RoomRef): void;
  /**
   * Has a message answered again. A lead's reply is dropped and that lead
   * writes it afresh. A message of yours is put to whoever it is for, as if
   * it had just been sent. `host` is as for `send`.
   */
  rerun(room: RoomRef, members: Project[], messageId: string, host?: Project): void;
  leadStatus(room: RoomRef, project: Project): LeadStatus;
  messages(room: RoomRef): Message[];
}

/** What this service needs to know of a room: where its messages are kept, and what leads are told it is called. */
export type RoomRef = Pick<StoredRoom, "id" | "name">;

interface Deps {
  db: Db;
  ledger: Ledger;
  bus: ConversationBus;
  turns: LeadTurns;
  gate: Gate;
  personas: Personas;
}

/** How much of the room a lead is shown. Older messages are not sent to it. */
const CONTEXT_MESSAGES = 60;

/** How much of the room the gate is shown. Who a message is for rarely depends on more. */
const GATE_CONTEXT_MESSAGES = 12;

const GATE_DOWN_HINT = "Could not work out who that was for. Use @ to address a project.";

export function createChannelService({ db, ledger, bus, turns, gate, personas }: Deps): ChannelService {
  /** Per room, the promise the next turn must wait for. This is what makes turns sequential. */
  const queues = new Map<string, Promise<void>>();

  /** `force` gives the turn even to a lead that owes nothing, which is what answering again means. */
  function enqueue(room: RoomRef, members: Project[], project: Project, wake: ChannelWake, force = false): void {
    const handleById = new Map(members.map((member) => [member.id, member.handle]));
    const handleOf = (projectId: string) => handleById.get(projectId) ?? "another project";

    const turn: Turn = {
      conversationId: room.id,
      project,
      reason: wake,
      contextMessages: CONTEXT_MESSAGES,
      prompts: (knowledge, history) => ({
        systemPrompt: channelSystemPrompt(project, knowledge, room.name, wake),
        prompt: channelPrompt(project, history, handleOf, wake),
      }),
    };

    const previous = queues.get(room.id) ?? Promise.resolve();
    queues.set(
      room.id,
      previous
        .then(() => {
          // Address a lead twice in quick succession and its first reply has read both
          // messages. By the time the second turn comes up there is nothing left to answer.
          if (force || owesReply(room, project)) return turns.run(turn);
        })
        .catch(() => undefined),
    );
  }

  /** True when you have said something since this lead last spoke. */
  function owesReply(room: RoomRef, project: Project): boolean {
    const recent = listRecentMessages(db, room.id, CONTEXT_MESSAGES);

    const lastSpoke = recent.findLastIndex((message) => message.authorProjectId === project.id);
    const lastFromYou = recent.findLastIndex((message) => message.authorKind === "user");
    return lastFromYou > lastSpoke;
  }

  /**
   * Asks the gate who, of everyone in the room, your message is for.
   * One call covers every member: they are judged against each other.
   */
  async function askGate(room: RoomRef, members: Project[], message: Message, force = false): Promise<void> {
    // Everything before your message. The gate is told the message itself separately.
    const recent = listRecentMessages(db, room.id, GATE_CONTEXT_MESSAGES + 1).filter(
      (earlier) => earlier.id < message.id,
    );

    const decision = await gate.decide({
      roomName: room.name,
      members: members.map((project) => ({ project, persona: personaOf(project) })),
      recent,
      message: message.body,
    });

    logGateCall(room, message, decision);

    // Silence is a fine outcome. A gate that could not answer is not: say so.
    if (decision.unavailable) return postSystemRow(room, GATE_DOWN_HINT);

    for (const project of decision.speakers) enqueue(room, members, project, "gate_speak", force);
  }

  /**
   * A member with no persona yet is judged on its name alone, so it rarely
   * wins. Its persona is started now, so that the next message finds it.
   */
  function personaOf(project: Project): string | null {
    const persona = ledger.readPersona(project.id);
    if (!persona) personas.prepare(project);
    return persona?.body ?? null;
  }

  /** Every gate decision is kept, with its reason, so the gate can be tuned from real rooms (R-SP-24). */
  function logGateCall(room: RoomRef, message: Message, decision: GateDecision): void {
    logEvent(db, "gate_called", room.id, {
      messageId: message.id,
      speakers: decision.speakers.map((project) => project.id),
      reason: decision.reason,
      latencyMs: decision.latencyMs,
      unavailable: decision.unavailable,
    });
  }

  /** The last thing said in the room, by you or a lead, before this message, or before now if none is given. */
  function previousMessage(room: RoomRef, before?: Message): Message | null {
    const said = listRecentMessages(db, room.id, CONTEXT_MESSAGES).filter(
      (message) => message.authorKind !== "system" && (!before || message.id < before.id),
    );
    return said.at(-1) ?? null;
  }

  /** Who a message is for, by the checks that need no model: a tag, then a name, then "you". */
  function addresseesOf(room: RoomRef, members: Project[], body: string, host: Project | undefined, before?: Message) {
    const tagged = taggedMembers(body, members);
    // With a host, anything not tagged is the host's. Names and "you" are not looked for.
    const named = tagged.length === 0 && !host ? namedMembers(body, members) : [];
    const spokenTo =
      tagged.length === 0 && named.length === 0 && !host
        ? leadSpokenTo(body, previousMessage(room, before), members)
        : null;

    return { tagged, named, spokenTo };
  }

  /** Gives a turn to everyone a message is for, asking the gate when the plain checks found nobody. */
  function dispatch(
    room: RoomRef,
    members: Project[],
    message: Message,
    { tagged, named, spokenTo }: ReturnType<typeof addresseesOf>,
    host: Project | undefined,
    force = false,
  ): void {
    if (tagged.length > 0) {
      for (const project of tagged) enqueue(room, members, project, "addressed", force);
    } else if (host) {
      enqueue(room, members, host, "gate_speak", force);
    } else if (named.length > 0) {
      for (const project of named) enqueue(room, members, project, "gate_speak", force);
    } else if (spokenTo) {
      enqueue(room, members, spokenTo, "gate_speak", force);
    } else {
      void askGate(room, members, message, force);
    }
  }

  function postSystemRow(room: RoomRef, body: string): void {
    const row = insertMessage(db, {
      conversationId: room.id,
      authorKind: "system",
      body,
      status: "complete",
      systemKind: "untagged_hint",
    });
    bus.publish(room.id, { type: "message.created", message: row });
  }

  return {
    send(room, members, body, host) {
      const addressees = addresseesOf(room, members, body, host);

      const message = insertMessage(db, {
        conversationId: room.id,
        authorKind: "user",
        body,
        status: "complete",
        mentions: addressees.tagged.map((project) => project.id),
      });

      saveDraft(db, room.id, "");
      logEvent(db, "message_sent", room.id, {
        messageId: message.id,
        tagged: message.mentions,
        named: addressees.named.map((project) => project.id),
        spokenTo: addressees.spokenTo?.id ?? null,
      });
      bus.publish(room.id, { type: "message.created", message });

      dispatch(room, members, message, addressees, host);
      return message;
    },

    stop(room) {
      turns.stop(room.id);
    },

    rerun(room, members, messageId, host) {
      const message = getMessage(db, messageId);
      if (message?.conversationId !== room.id || message.status === "streaming") return;

      if (message.authorKind === "user") {
        dispatch(room, members, message, addresseesOf(room, members, message.body, host, message), host, true);
        return;
      }

      const project = members.find((member) => member.id === message.authorProjectId);
      if (message.authorKind !== "lead" || !project) return;

      deleteMessage(db, message.id);
      bus.publish(room.id, { type: "message.removed", messageId: message.id });
      enqueue(room, members, project, message.wakeReason === "gate_speak" ? "gate_speak" : "addressed", true);
    },

    leadStatus(room, project) {
      return turns.status(room.id, project.id);
    },

    messages(room) {
      return turns.messages(room.id);
    },
  };
}

/**
 * Who a message tags, in the order tagged. "@all" stands for every member
 * not already named. A handle that is not a member is plain text.
 */
export function taggedMembers(body: string, members: readonly Project[]): Project[] {
  const byHandle = new Map(members.map((member) => [member.handle, member]));
  const tagged = new Map<string, Project>();

  for (const handle of findMentions(body)) {
    const named = handle === MENTION_ALL ? members : [byHandle.get(handle)];
    for (const project of named) {
      if (project) tagged.set(project.id, project);
    }
  }

  return [...tagged.values()];
}

/**
 * Who a message names in plain words, with no "@": by handle or by display
 * name, as a whole word, in the order they appear.
 *
 * "Whole word" treats "-" as part of a word, so "conduit" is not found inside
 * "conduit-rooms" and each project is only ever matched by its own name.
 */
export function namedMembers(body: string, members: readonly Project[]): Project[] {
  const found = members.flatMap((project) => {
    const names = [...new Set([project.handle, project.displayName.toLowerCase()])];
    const positions = names.map((name) => positionOfWord(body.toLowerCase(), name)).filter((at) => at !== -1);

    return positions.length > 0 ? [{ project, at: Math.min(...positions) }] : [];
  });

  return found.sort((a, b) => a.at - b.at).map(({ project }) => project);
}

function positionOfWord(text: string, word: string): number {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.search(new RegExp(`(?<![a-z0-9@-])${escaped}(?![a-z0-9-])`));
}

/** "you", "your", "yours", "you're", and the short forms people type. */
const SECOND_PERSON = /(?<![a-z0-9@'-])(you|your|yours|yourself|you're|youre|you've|you'll|you'd|u|ur)(?![a-z0-9-])/i;

/**
 * The lead a message speaks to with "you", if there is one: the lead whose
 * reply is the last thing said in the room (specs/07-speaking-policy.md,
 * ownership rule 4). "You" with no lead having just spoken points at nobody.
 */
export function leadSpokenTo(
  body: string,
  previous: Message | null,
  members: readonly Project[],
): Project | null {
  if (previous?.authorKind !== "lead" || !SECOND_PERSON.test(body)) return null;
  return members.find((member) => member.id === previous.authorProjectId) ?? null;
}
