import {
  API_PREFIX,
  type ActivityResponse,
  type BriefResponse,
  type DirectChat,
  type DirectChatResponse,
  type DirectChatsResponse,
  PERSONA_MAX_LENGTH,
  type PersonaResponse,
  type ProjectsResponse,
} from "@rooms/shared";
import { Hono } from "hono";
import { z } from "zod";
import { readConduitProjects } from "../../conduit/readProjects";
import {
  ensureDirectChats,
  getDirectChat,
  listDirectChats,
  setDirectChatAdded,
  type StoredDirectChat,
} from "../../store/directChats";
import { listProjects, syncProjects } from "../../store/projects";
import { requireDirectChat, requireProject, type AppContext } from "../context";
import { invalid } from "../errors";

const updateDirectChatBody = z.object({ added: z.boolean() });
const savePersonaBody = z.object({ body: z.string().trim().min(1).max(PERSONA_MAX_LENGTH) });

/**
 * Conduit owns the project list. Each read of it here re-reads Conduit's
 * state file, so a project added in Conduit shows up on the next fetch.
 */
async function refreshProjects(ctx: AppContext): Promise<void> {
  const conduitProjects = await readConduitProjects(ctx.config.conduitDataDir);
  syncProjects(ctx.db, conduitProjects);
  ensureDirectChats(ctx.db);
}

export function projectRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  const withLeadStatus = (chat: StoredDirectChat): DirectChat => ({
    ...chat,
    leadStatus: ctx.directChats.leadStatus(chat),
  });

  app.get(`${API_PREFIX}/projects`, async (c) => {
    await refreshProjects(ctx);
    return c.json<ProjectsResponse>({ projects: listProjects(ctx.db) });
  });

  /** What each project's sessions are doing in Conduit. Straight from its state file, nothing stored. */
  app.get(`${API_PREFIX}/activity`, async (c) => {
    const conduitProjects = await readConduitProjects(ctx.config.conduitDataDir);
    return c.json<ActivityResponse>({ activity: conduitProjects.map((project) => project.activity) });
  });

  app.get(`${API_PREFIX}/direct-chats`, async (c) => {
    await refreshProjects(ctx);
    return c.json<DirectChatsResponse>({ directChats: listDirectChats(ctx.db).map(withLeadStatus) });
  });

  app.patch(`${API_PREFIX}/direct-chats/:conversationId`, async (c) => {
    const chat = requireDirectChat(ctx, c.req.param("conversationId"));
    const parsed = updateDirectChatBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw invalid("Expected { added: boolean }.");

    setDirectChatAdded(ctx.db, chat.id, parsed.data.added);
    return c.json<DirectChatResponse>({ directChat: withLeadStatus(getDirectChat(ctx.db, chat.id)!) });
  });

  app.get(`${API_PREFIX}/projects/:projectId/brief`, (c) => {
    const project = requireProject(ctx, c.req.param("projectId"));
    return c.json<BriefResponse>({ brief: ctx.ledger.readBrief(project.id) });
  });

  /** Opening a persona that does not exist yet starts the lead writing one. */
  app.get(`${API_PREFIX}/projects/:projectId/persona`, (c) => {
    const project = requireProject(ctx, c.req.param("projectId"));
    const persona = ctx.ledger.readPersona(project.id);
    if (!persona) ctx.personas.prepare(project);

    return c.json<PersonaResponse>({ persona, writing: ctx.personas.isWriting(project.id) });
  });

  /** Your edit of a persona. It becomes the current version and is what the gate reads from then on. */
  app.put(`${API_PREFIX}/projects/:projectId/persona`, async (c) => {
    const project = requireProject(ctx, c.req.param("projectId"));
    const parsed = savePersonaBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw invalid(`A persona is 1 to ${PERSONA_MAX_LENGTH} characters.`);

    const persona = ctx.ledger.writePersona(project.id, parsed.data.body, "user");
    return c.json<PersonaResponse>({ persona, writing: false });
  });

  return app;
}
