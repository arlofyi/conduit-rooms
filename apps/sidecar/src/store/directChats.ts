import { newId, type DirectChat } from "@rooms/shared";

/** A direct chat as stored. The lead's live status is added by the chat service. */
export type StoredDirectChat = Omit<DirectChat, "leadStatus">;
import type { Db } from "./db";

interface DirectChatRow {
  id: string;
  project_id: string;
  added_at: string | null;
  last_activity_at: string | null;
}

function toDirectChat(row: DirectChatRow): StoredDirectChat {
  return {
    id: row.id,
    projectId: row.project_id,
    addedAt: row.added_at,
    lastActivityAt: row.last_activity_at,
  };
}

/** Every project has exactly one direct chat, from the moment it exists (R-DM-01). */
export function ensureDirectChats(db: Db): void {
  const missing = db
    .prepare(
      `SELECT p.id FROM projects p
        LEFT JOIN direct_chats d ON d.project_id = p.id
        WHERE d.id IS NULL`,
    )
    .all() as unknown as Array<{ id: string }>;

  const insert = db.prepare("INSERT INTO direct_chats (id, project_id) VALUES (?, ?)");
  for (const { id: projectId } of missing) insert.run(newId("directChat"), projectId);

  // A project's room is listed once you add it. A product you made or an agent you hired
  // is always listed: making it was the adding.
  db.prepare(
    `UPDATE direct_chats SET added_at = ?
      WHERE added_at IS NULL
        AND project_id IN (SELECT id FROM projects WHERE kind <> 'project')`,
  ).run(new Date().toISOString());
}

/** Direct chats of the projects currently in Conduit. */
export function listDirectChats(db: Db): StoredDirectChat[] {
  const rows = db
    .prepare(
      `SELECT d.* FROM direct_chats d
         JOIN projects p ON p.id = d.project_id
        WHERE p.present = 1`,
    )
    .all() as unknown as DirectChatRow[];
  return rows.map(toDirectChat);
}

export function getDirectChat(db: Db, id: string): StoredDirectChat | null {
  const row = db.prepare("SELECT * FROM direct_chats WHERE id = ?").get(id) as
    | DirectChatRow
    | undefined;
  return row ? toDirectChat(row) : null;
}

export function touchDirectChat(db: Db, id: string, at: string): void {
  db.prepare("UPDATE direct_chats SET last_activity_at = ? WHERE id = ?").run(at, id);
}

/** Lists the room in the sidebar, or takes it off. Messages are never touched. */
export function setDirectChatAdded(db: Db, id: string, added: boolean): void {
  db.prepare("UPDATE direct_chats SET added_at = ? WHERE id = ?").run(
    added ? new Date().toISOString() : null,
    id,
  );
}
