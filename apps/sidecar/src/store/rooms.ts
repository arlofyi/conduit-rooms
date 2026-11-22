import { newId, type Project } from "@rooms/shared";
import { transaction, type Db } from "./db";
import { toProject, type ProjectRow } from "./projects";

/** A room as stored. Each member's live lead status is added by the route that returns it. */
export interface StoredRoom {
  id: string;
  name: string;
  createdAt: string;
}

interface RoomRow {
  id: string;
  name: string;
  created_at: string;
}

function toRoom(row: RoomRow): StoredRoom {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function listRooms(db: Db): StoredRoom[] {
  const rows = db.prepare("SELECT * FROM rooms ORDER BY created_at, id").all() as unknown as RoomRow[];
  return rows.map(toRoom);
}

export function getRoom(db: Db, id: string): StoredRoom | null {
  const row = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as RoomRow | undefined;
  return row ? toRoom(row) : null;
}

export function isRoomNameTaken(db: Db, name: string, exceptRoomId?: string): boolean {
  const row = db.prepare("SELECT id FROM rooms WHERE name = ?").get(name) as { id: string } | undefined;
  return row !== undefined && row.id !== exceptRoomId;
}

/**
 * A room's members, in the order you added them. A member whose project has
 * since been removed from Conduit is left out, and comes back if the project does.
 */
export function listRoomMembers(db: Db, roomId: string): Project[] {
  const rows = db
    .prepare(
      `SELECT p.*
         FROM room_members m
         JOIN projects p ON p.id = m.project_id
        WHERE m.room_id = ? AND p.present = 1
        ORDER BY m.position`,
    )
    .all(roomId) as unknown as ProjectRow[];

  return rows.map(toProject);
}

export function createRoom(db: Db, name: string, memberIds: readonly string[]): StoredRoom {
  const room: StoredRoom = { id: newId("room"), name, createdAt: new Date().toISOString() };

  transaction(db, () => {
    db.prepare("INSERT INTO rooms (id, name, created_at) VALUES (?, ?, ?)").run(
      room.id,
      room.name,
      room.createdAt,
    );
    replaceMembers(db, room.id, memberIds);
  });

  return room;
}

export function renameRoom(db: Db, roomId: string, name: string): void {
  db.prepare("UPDATE rooms SET name = ? WHERE id = ?").run(name, roomId);
}

/** Sets a room's members to exactly this list, in this order. */
export function setRoomMembers(db: Db, roomId: string, memberIds: readonly string[]): void {
  transaction(db, () => replaceMembers(db, roomId, memberIds));
}

function replaceMembers(db: Db, roomId: string, memberIds: readonly string[]): void {
  db.prepare("DELETE FROM room_members WHERE room_id = ?").run(roomId);

  const insert = db.prepare("INSERT INTO room_members (room_id, project_id, position) VALUES (?, ?, ?)");
  [...new Set(memberIds)].forEach((projectId, position) => insert.run(roomId, projectId, position));
}

