import {
  API_PREFIX,
  MESSAGE_MAX_LENGTH,
  type DraftResponse,
  type MessagesResponse,
  type SendMessageResponse,
} from "@rooms/shared";
import { Hono } from "hono";
import { z } from "zod";
import { getDraft, saveDraft } from "../../store/drafts";
import type { AppContext } from "../context";
import { requireConversation } from "../conversation";
import { invalid } from "../errors";

const sendMessageBody = z.object({
  body: z.string().trim().min(1, "A message cannot be empty.").max(MESSAGE_MAX_LENGTH),
});

const saveDraftBody = z.object({
  body: z.string().max(MESSAGE_MAX_LENGTH),
});

async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const json = await request.json().catch(() => {
    throw invalid("The request body must be JSON.");
  });

  const parsed = schema.safeParse(json);
  if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}

/** Routes that work the same on a project room and a common room. */
export function conversationRoutes(ctx: AppContext): Hono {
  const app = new Hono();
  const base = `${API_PREFIX}/conversations/:conversationId`;

  app.get(`${base}/messages`, (c) => {
    const conversation = requireConversation(ctx, c.req.param("conversationId"));
    return c.json<MessagesResponse>({ messages: conversation.messages() });
  });

  app.post(`${base}/messages`, async (c) => {
    const conversation = requireConversation(ctx, c.req.param("conversationId"));
    const { body } = await parseBody(c.req.raw, sendMessageBody);

    return c.json<SendMessageResponse>({ message: conversation.send(body) }, 201);
  });

  app.post(`${base}/messages/:messageId/rerun`, (c) => {
    requireConversation(ctx, c.req.param("conversationId")).rerun(c.req.param("messageId"));
    return c.body(null, 204);
  });

  app.post(`${base}/stop`, (c) => {
    requireConversation(ctx, c.req.param("conversationId")).stop();
    return c.body(null, 204);
  });

  app.get(`${base}/draft`, (c) => {
    const { id } = requireConversation(ctx, c.req.param("conversationId"));
    return c.json<DraftResponse>({ draft: getDraft(ctx.db, id) });
  });

  app.put(`${base}/draft`, async (c) => {
    const { id } = requireConversation(ctx, c.req.param("conversationId"));
    const { body } = await parseBody(c.req.raw, saveDraftBody);
    return c.json<DraftResponse>({ draft: saveDraft(ctx.db, id, body) });
  });

  return app;
}
