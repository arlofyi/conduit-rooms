import { newId } from "@rooms/shared";
import type { Db } from "./db";

/**
 * The append-only log of what happened and why (specs/10-data-model.md,
 * RoomEvent). It is the audit trail today and the gate's tuning data later.
 */
export type EventKind =
  | "message_sent"
  | "gate_called"
  | "wake_started"
  | "wake_finished"
  | "wake_failed"
  | "wake_stopped"
  | "brief_refreshed"
  | "brief_refresh_failed";

export function logEvent(
  db: Db,
  kind: EventKind,
  conversationId: string | null,
  data: Record<string, unknown> = {},
): void {
  db.prepare("INSERT INTO events (id, conversation_id, at, kind, data) VALUES (?, ?, ?, ?, ?)").run(
    newId("event"),
    conversationId,
    new Date().toISOString(),
    kind,
    JSON.stringify(data),
  );
}
