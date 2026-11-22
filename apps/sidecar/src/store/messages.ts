import {
  newId,
  type AuthorKind,
  type LeadFailure,
  type Message,
  type MessageStatus,
  type ReplyStep,
  type SystemKind,
  type WakeReason,
} from "@rooms/shared";
import type { Db } from "./db";

interface MessageRow {
  id: string;
  conversation_id: string;
  author_kind: AuthorKind;
  author_project_id: string | null;
  body: string;
  mentions: string;
  status: MessageStatus;
  wake_id: string | null;
  wake_reason: WakeReason | null;
  system_kind: SystemKind | null;
  failure: string | null;
  steps: string | null;
  took_ms: number | null;
  created_at: string;
  edited_at: string | null;
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorKind: row.author_kind,
    authorProjectId: row.author_project_id,
    body: row.body,
    mentions: JSON.parse(row.mentions) as string[],
    status: row.status,
    wakeId: row.wake_id,
    wakeReason: row.wake_reason,
    systemKind: row.system_kind,
    failure: row.failure ? (JSON.parse(row.failure) as LeadFailure) : null,
    steps: row.steps ? (JSON.parse(row.steps) as ReplyStep[]) : null,
    tookMs: row.took_ms,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

export interface NewMessage {
  conversationId: string;
  authorKind: AuthorKind;
  body: string;
  status: MessageStatus;
  authorProjectId?: string;
  /** Ids of the projects this message tags. */
  mentions?: string[];
  wakeId?: string;
  wakeReason?: WakeReason;
  systemKind?: SystemKind;
}

export function insertMessage(db: Db, input: NewMessage): Message {
  const message: Message = {
    id: newId("message"),
    conversationId: input.conversationId,
    authorKind: input.authorKind,
    authorProjectId: input.authorProjectId ?? null,
    body: input.body,
    mentions: input.mentions ?? [],
    status: input.status,
    wakeId: input.wakeId ?? null,
    wakeReason: input.wakeReason ?? null,
    systemKind: input.systemKind ?? null,
    failure: null,
    steps: null,
    tookMs: null,
    createdAt: new Date().toISOString(),
    editedAt: null,
  };

  db.prepare(
    `INSERT INTO messages
       (id, conversation_id, author_kind, author_project_id, body, mentions,
        status, wake_id, wake_reason, system_kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    message.id,
    message.conversationId,
    message.authorKind,
    message.authorProjectId,
    message.body,
    JSON.stringify(message.mentions),
    message.status,
    message.wakeId,
    message.wakeReason,
    message.systemKind,
    message.createdAt,
  );

  return message;
}

export function getMessage(db: Db, id: string): Message | null {
  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as
    | MessageRow
    | undefined;
  return row ? toMessage(row) : null;
}

/** A conversation's messages, oldest first. */
export function listMessages(db: Db, conversationId: string): Message[] {
  const rows = db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id")
    .all(conversationId) as unknown as MessageRow[];
  return rows.map(toMessage);
}

/** The newest `limit` messages, oldest first. This is what a lead is shown (R-DM-16). */
export function listRecentMessages(db: Db, conversationId: string, limit: number): Message[] {
  const rows = db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?")
    .all(conversationId, limit) as unknown as MessageRow[];
  return rows.reverse().map(toMessage);
}

/** Saves a reply as far as it has got, so a crash partway keeps what was written and what was looked up. */
export function saveStreamedReply(db: Db, id: string, body: string, steps: readonly ReplyStep[]): void {
  db.prepare("UPDATE messages SET body = ?, steps = ? WHERE id = ?").run(body, JSON.stringify(steps), id);
}

export interface Settlement {
  status: Exclude<MessageStatus, "streaming">;
  body: string;
  failure?: LeadFailure;
  /** Left out for a reply that never got as far as a wake. */
  steps?: readonly ReplyStep[];
  tookMs?: number;
}

/** Ends a streaming message as complete, stopped or failed. */
export function settleMessage(db: Db, id: string, settlement: Settlement): Message {
  db.prepare("UPDATE messages SET status = ?, body = ?, failure = ?, steps = ?, took_ms = ? WHERE id = ?").run(
    settlement.status,
    settlement.body,
    settlement.failure ? JSON.stringify(settlement.failure) : null,
    settlement.steps ? JSON.stringify(settlement.steps) : null,
    settlement.tookMs ?? null,
    id,
  );
  return getMessage(db, id)!;
}

/**
 * A reply still marked streaming at boot was cut off by a crash or a quit.
 * No wake survives a restart, so it is closed as stopped with what it had.
 */
export function closeInterruptedMessages(db: Db): number {
  const result = db
    .prepare("UPDATE messages SET status = 'stopped' WHERE status = 'streaming'")
    .run();
  return Number(result.changes);
}

/** Only a lead's reply is ever removed, and only when you have it answered again. */
export function deleteMessage(db: Db, id: string): void {
  // The pages it came with go too: an artifact with no reply to open it from would never be seen again.
  db.prepare("DELETE FROM artifacts WHERE message_id = ?").run(id);
  db.prepare("DELETE FROM messages WHERE id = ?").run(id);
}
