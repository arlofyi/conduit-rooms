import { newId, type Artifact, type ArtifactRef } from "@rooms/shared";
import type { Db } from "./db";

/** Pages agents write for you to open. See the note on `Artifact` in packages/shared. */

interface ArtifactRow {
  id: string;
  conversation_id: string;
  message_id: string;
  project_id: string;
  title: string;
  html: string;
  created_at: string;
}

const REF_COLUMNS = "id, conversation_id, message_id, project_id, title, created_at";

function toRef(row: Omit<ArtifactRow, "html">): ArtifactRef {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    projectId: row.project_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

export type NewArtifact = Pick<Artifact, "conversationId" | "messageId" | "projectId" | "title" | "html">;

export function insertArtifact(db: Db, input: NewArtifact): ArtifactRef {
  const artifact: ArtifactRef = {
    id: newId("artifact"),
    conversationId: input.conversationId,
    messageId: input.messageId,
    projectId: input.projectId,
    title: input.title,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO artifacts (id, conversation_id, message_id, project_id, title, html, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    artifact.id,
    artifact.conversationId,
    artifact.messageId,
    artifact.projectId,
    artifact.title,
    input.html,
    artifact.createdAt,
  );

  return artifact;
}

/** A conversation's artifacts, oldest first, without their pages. */
export function listArtifacts(db: Db, conversationId: string): ArtifactRef[] {
  const rows = db
    .prepare(`SELECT ${REF_COLUMNS} FROM artifacts WHERE conversation_id = ? ORDER BY id`)
    .all(conversationId) as unknown as Array<Omit<ArtifactRow, "html">>;
  return rows.map(toRef);
}

export function getArtifact(db: Db, id: string): Artifact | null {
  const row = db.prepare("SELECT * FROM artifacts WHERE id = ?").get(id) as ArtifactRow | undefined;
  return row ? { ...toRef(row), html: row.html } : null;
}
