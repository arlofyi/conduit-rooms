import {
  AGENT_BRIEFING_MAX_LENGTH,
  AGENT_INSTRUCTIONS_MAX_LENGTH,
  AGENT_NAME_MAX_LENGTH,
  API_PREFIX,
  PERSONA_MAX_LENGTH,
  type AgentResponse,
  type DraftAgentResponse,
} from "@rooms/shared";
import { Hono } from "hono";
import { z } from "zod";
import { draftAgent } from "../../leads/hiring";
import { WakeFailedError } from "../../leads/runtime";
import { ensureDirectChats } from "../../store/directChats";
import { dismissAgent, getHiredAgent, hireAgent, updateInstructions } from "../../store/hiredAgents";
import { getProject } from "../../store/projects";
import type { AppContext } from "../context";
import { HttpError, invalid, notFound } from "../errors";

const name = z.string().trim().min(2, "Give the agent a name.").max(AGENT_NAME_MAX_LENGTH);
const instructions = z
  .string()
  .trim()
  .min(1, "An agent needs instructions.")
  .max(AGENT_INSTRUCTIONS_MAX_LENGTH);

const draftBody = z.object({
  name,
  briefing: z.string().trim().min(8, "Say a little more about what it should do.").max(AGENT_BRIEFING_MAX_LENGTH),
});

const hireBody = z.object({
  name,
  instructions,
  persona: z.string().trim().min(1, "An agent needs a persona.").max(PERSONA_MAX_LENGTH),
});

const updateBody = z.object({ instructions });

async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}

/**
 * Hiring agents: the ones you make, that belong to no project.
 *
 *   POST   /agents/draft   name + what you want it for  ->  instructions and persona to edit
 *   POST   /agents         hire it
 *   GET    /agents/:id     its instructions
 *   PATCH  /agents/:id     change its instructions
 *   DELETE /agents/:id     let it go
 *
 * Once hired, an agent is listed by /projects and has a room like any project.
 */
export function agentRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  function requireAgent(agentId: string): AgentResponse {
    const agent = getProject(ctx.db, agentId);
    const hired = getHiredAgent(ctx.db, agentId);

    if (!agent || !hired || agent.kind !== "hired") throw notFound("That agent");
    return { agent, hired };
  }

  app.post(`${API_PREFIX}/agents/draft`, async (c) => {
    const { name, briefing } = await parseBody(c.req.raw, draftBody);

    try {
      return c.json<DraftAgentResponse>(await draftAgent(ctx.runtime, name, briefing));
    } catch (error) {
      // A draft is a convenience. If it fails you can still write both documents yourself.
      const reason = error instanceof WakeFailedError ? error.failure.message : "The draft could not be written.";
      throw new HttpError("conflict", `${reason} You can write the instructions and persona yourself.`);
    }
  });

  app.post(`${API_PREFIX}/agents`, async (c) => {
    const { name, instructions, persona } = await parseBody(c.req.raw, hireBody);

    const hiring = hireAgent(ctx.db, name, instructions);
    ctx.ledger.writePersona(hiring.agent.id, persona, "user");
    ensureDirectChats(ctx.db);

    return c.json<AgentResponse>(hiring, 201);
  });

  app.get(`${API_PREFIX}/agents/:agentId`, (c) => c.json<AgentResponse>(requireAgent(c.req.param("agentId"))));

  app.patch(`${API_PREFIX}/agents/:agentId`, async (c) => {
    const { agent } = requireAgent(c.req.param("agentId"));
    const { instructions } = await parseBody(c.req.raw, updateBody);

    updateInstructions(ctx.db, agent.id, instructions);
    return c.json<AgentResponse>(requireAgent(agent.id));
  });

  app.delete(`${API_PREFIX}/agents/:agentId`, (c) => {
    const { agent } = requireAgent(c.req.param("agentId"));
    dismissAgent(ctx.db, agent.id);
    return c.body(null, 204);
  });

  return app;
}
