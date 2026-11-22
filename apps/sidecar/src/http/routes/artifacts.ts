import { API_PREFIX, type ArtifactResponse, type ArtifactsResponse } from "@rooms/shared";
import { Hono } from "hono";
import { getArtifact, listArtifacts } from "../../store/artifacts";
import type { AppContext } from "../context";
import { requireConversation } from "../conversation";
import { notFound } from "../errors";

/**
 * Artifacts: the pages agents write for you. They are made by an agent's
 * tool during a reply (leads/appTools.ts), so there is no route that writes
 * one. These two only read.
 */
export function artifactRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  app.get(`${API_PREFIX}/conversations/:conversationId/artifacts`, (c) => {
    const { id } = requireConversation(ctx, c.req.param("conversationId"));
    return c.json<ArtifactsResponse>({ artifacts: listArtifacts(ctx.db, id) });
  });

  app.get(`${API_PREFIX}/artifacts/:artifactId`, (c) => {
    const artifact = getArtifact(ctx.db, c.req.param("artifactId"));
    if (!artifact) throw notFound("That artifact");
    return c.json<ArtifactResponse>({ artifact });
  });

  return app;
}
