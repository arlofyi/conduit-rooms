import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { projectStatus, sessionStatus, type ProjectActivity } from "@rooms/shared";
import { z } from "zod";
import { projectAccent } from "./projectColor";

/**
 * Conduit's project list, read straight from its state file.
 *
 * Rooms only ever reads this file. Conduit rewrites it on every change and a
 * second writer would corrupt the installed app's projects and sessions.
 */

export interface ConduitProject {
  id: string;
  name: string;
  path: string;
  color: string;
  /** What its sessions are doing, as of this read. */
  activity: ProjectActivity;
  /** What Rooms needs to find each session's transcript and terminal. Never sent to the app. */
  sessions: ConduitSession[];
}

export interface ConduitSession {
  id: string;
  agent: string;
  /**
   * The id of the conversation the session is on now. It starts equal to the
   * session id and moves when the session is cleared or resumed, so a
   * transcript is always found by this, never by the session id.
   */
  conversationId: string;
}

// Only the fields Rooms uses. Conduit's state has many more, and they change between releases.
const stateSchema = z.object({
  projects: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      path: z.string().min(1),
      color: z.string().nullish(),
      sessions: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            agent: z.string().default("claude"),
            role: z.enum(["worker", "conductor"]).catch("worker"),
            agentState: z.string().nullish(),
            stopped: z.boolean().default(false),
            agentConversationId: z.string().nullish(),
            branch: z.string().nullish(),
          }),
        )
        .default([]),
    }),
  ),
});

export class ConduitStateError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConduitStateError";
  }
}

/** Projects in the order Conduit lists them (R-UI-01). */
export async function readConduitProjects(conduitDataDir: string): Promise<ConduitProject[]> {
  const path = join(conduitDataDir, "state.json");

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new ConduitStateError(`Could not read ${path}`, { cause });
  }

  const parsed = stateSchema.safeParse(parseJson(raw, path));
  if (!parsed.success) {
    throw new ConduitStateError(`Conduit's state file has an unexpected shape: ${path}`);
  }

  return parsed.data.projects.map((project) => {
    const sessions = project.sessions.map((session) => ({
      id: session.id,
      name: session.name,
      agent: session.agent,
      role: session.role,
      status: sessionStatus(session.agentState, session.stopped),
      branch: session.branch ?? null,
    }));

    return {
      id: project.id,
      name: project.name,
      path: project.path,
      color: project.color || projectAccent(project.id),
      activity: { projectId: project.id, status: projectStatus(sessions), sessions },
      sessions: project.sessions.map((session) => ({
        id: session.id,
        agent: session.agent,
        conversationId: session.agentConversationId || session.id,
      })),
    };
  });
}

function parseJson(raw: string, path: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    // Conduit writes the file in place, so a read can land mid-write.
    throw new ConduitStateError(`Conduit's state file is not valid JSON right now: ${path}`, { cause });
  }
}
