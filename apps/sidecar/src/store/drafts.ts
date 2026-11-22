import type { Draft } from "@rooms/shared";
import type { Db } from "./db";

interface DraftRow {
  conversation_id: string;
  body: string;
  updated_at: string;
}

export function getDraft(db: Db, conversationId: string): Draft | null {
  const row = db.prepare("SELECT * FROM drafts WHERE conversation_id = ?").get(conversationId) as
    | DraftRow
    | undefined;

  return row
    ? { conversationId: row.conversation_id, body: row.body, updatedAt: row.updated_at }
    : null;
}

/** Saving an empty draft removes it, so a sent message leaves nothing behind. */
export function saveDraft(db: Db, conversationId: string, body: string): Draft | null {
  if (body.length === 0) {
    db.prepare("DELETE FROM drafts WHERE conversation_id = ?").run(conversationId);
    return null;
  }

  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO drafts (conversation_id, body, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (conversation_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
  ).run(conversationId, body, updatedAt);

  return { conversationId, body, updatedAt };
}
