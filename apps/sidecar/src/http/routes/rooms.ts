import {
  API_PREFIX,
  HANDLE_MAX,
  HANDLE_MIN,
  isValidHandle,
  type Room,
  type RoomResponse,
  type RoomsResponse,
} from "@rooms/shared";
import { Hono } from "hono";
import { z } from "zod";
import { getProject } from "../../store/projects";
import {
  createRoom,
  getRoom,
  isRoomNameTaken,
  listRoomMembers,
  listRooms,
  renameRoom,
  setRoomMembers,
  type StoredRoom,
} from "../../store/rooms";
import type { AppContext } from "../context";
import { HttpError, invalid, notFound } from "../errors";

const roomName = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidHandle, `A room name is ${HANDLE_MIN} to ${HANDLE_MAX} characters: a to z, 0 to 9 and "-".`);

const createRoomBody = z.object({
  name: roomName,
  memberIds: z.array(z.string()).default([]),
});

const updateRoomBody = z.object({
  name: roomName.optional(),
  memberIds: z.array(z.string()).optional(),
});

async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}

/** Common rooms: the channels you create and the leads you put in them. */
export function roomRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  /** A lead needs a persona before the gate can tell what is for it, so one is started as it joins. */
  function preparePersonas(room: StoredRoom): void {
    for (const project of listRoomMembers(ctx.db, room.id)) ctx.personas.prepare(project);
  }

  const withMembers = (room: StoredRoom): Room => ({
    ...room,
    members: listRoomMembers(ctx.db, room.id).map((project) => ({
      projectId: project.id,
      leadStatus: ctx.channels.leadStatus(room, project),
    })),
  });

  function requireRoom(roomId: string): StoredRoom {
    const room = getRoom(ctx.db, roomId);
    if (!room) throw notFound("That room");
    return room;
  }

  function requireFreeName(name: string, exceptRoomId?: string): void {
    if (isRoomNameTaken(ctx.db, name, exceptRoomId)) {
      throw new HttpError("conflict", `There is already a room called #${name}.`);
    }
  }

  function requireKnownProjects(memberIds: readonly string[]): void {
    const unknown = memberIds.find((projectId) => !getProject(ctx.db, projectId));
    if (unknown) throw invalid("One of those projects does not exist.");
  }

  app.get(`${API_PREFIX}/rooms`, (c) =>
    c.json<RoomsResponse>({ rooms: listRooms(ctx.db).map(withMembers) }),
  );

  app.post(`${API_PREFIX}/rooms`, async (c) => {
    const { name, memberIds } = await parseBody(c.req.raw, createRoomBody);
    requireFreeName(name);
    requireKnownProjects(memberIds);

    const room = createRoom(ctx.db, name, memberIds);
    preparePersonas(room);
    return c.json<RoomResponse>({ room: withMembers(room) }, 201);
  });

  app.patch(`${API_PREFIX}/rooms/:roomId`, async (c) => {
    const room = requireRoom(c.req.param("roomId"));
    const { name, memberIds } = await parseBody(c.req.raw, updateRoomBody);

    if (name !== undefined) {
      requireFreeName(name, room.id);
      renameRoom(ctx.db, room.id, name);
    }
    if (memberIds !== undefined) {
      requireKnownProjects(memberIds);
      setRoomMembers(ctx.db, room.id, memberIds);
      preparePersonas(room);
    }

    return c.json<RoomResponse>({ room: withMembers(requireRoom(room.id)) });
  });

  return app;
}
