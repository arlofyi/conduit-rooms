import {
  API_PREFIX,
  MESSAGE_MAX_LENGTH,
  SESSION_IMAGE_MAX_BYTES,
  SESSION_IMAGE_TYPES,
  SESSION_IMAGES_MAX,
  type SessionImageType,
  type SessionTerminalResponse,
  type SessionTranscriptResponse,
} from "@rooms/shared";
import { Hono } from "hono";
import { z } from "zod";
import { readConduitProjects, type ConduitSession } from "../../conduit/readProjects";
import { saveImages } from "../../sessions/images";
import { readTerminal, sendInput, sendMessage, SessionNotRunningError } from "../../sessions/terminal";
import { readTranscript } from "../../sessions/transcript";
import type { AppContext } from "../context";
import { HttpError, invalid, notFound } from "../errors";

/** A picture's base64 text is a third longer than its bytes. */
const IMAGE_MAX_BASE64 = Math.ceil((SESSION_IMAGE_MAX_BYTES * 4) / 3) + 4;

const image = z.object({
  mediaType: z.enum(Object.keys(SESSION_IMAGE_TYPES) as [SessionImageType, ...SessionImageType[]]),
  data: z.string().min(1).max(IMAGE_MAX_BASE64),
});

const messageBody = z
  .object({
    text: z.string().trim().max(MESSAGE_MAX_LENGTH),
    images: z.array(image).max(SESSION_IMAGES_MAX).default([]),
  })
  .refine((message) => message.text.length > 0 || message.images.length > 0);

/** Keystrokes arrive a few at a time. This is far more than a burst of typing or a paste needs. */
const inputBody = z.object({ data: z.string().min(1).max(8_192) });

/**
 * One of Conduit's sessions: reading its conversation and its terminal, and
 * typing into it.
 *
 * Typing into a session is running commands on this machine. It is guarded
 * the same way as every route (this port answers only to 127.0.0.1, with the
 * token, from the app's own origin), and it accepts only session ids that
 * Conduit itself lists.
 */
export function sessionRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  /** Only ids that Conduit itself lists are accepted, so a request cannot name an arbitrary file or tmux target. */
  async function requireSession(sessionId: string): Promise<ConduitSession> {
    const projects = await readConduitProjects(ctx.config.conduitDataDir);
    const session = projects.flatMap((project) => project.sessions).find((entry) => entry.id === sessionId);

    if (!session) throw notFound("That session");
    return session;
  }

  app.get(`${API_PREFIX}/sessions/:sessionId/transcript`, async (c) => {
    const session = await requireSession(c.req.param("sessionId"));

    // Only Claude writes the transcript format this reads.
    const transcript =
      session.agent === "claude"
        ? await readTranscript(session.conversationId)
        : { items: [], truncated: false, unavailable: "not_claude" as const };

    return c.json<SessionTranscriptResponse>({ transcript });
  });

  app.get(`${API_PREFIX}/sessions/:sessionId/terminal`, async (c) => {
    const session = await requireSession(c.req.param("sessionId"));
    return c.json<SessionTerminalResponse>({ terminal: await readTerminal(session.id) });
  });

  app.post(`${API_PREFIX}/sessions/:sessionId/message`, async (c) => {
    const session = await requireSession(c.req.param("sessionId"));
    const parsed = messageBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      throw invalid(`A message needs text or a picture, with at most ${SESSION_IMAGES_MAX} pictures of 5 MB each.`);
    }

    const { text, images } = parsed.data;
    const imagePaths = await saveImages(images);
    await typeInto(() => sendMessage(session.id, text, imagePaths));
    return c.body(null, 204);
  });

  app.post(`${API_PREFIX}/sessions/:sessionId/input`, async (c) => {
    const session = await requireSession(c.req.param("sessionId"));
    const parsed = inputBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw invalid("Expected { data: string }.");

    await typeInto(() => sendInput(session.id, parsed.data.data));
    return c.body(null, 204);
  });

  return app;
}

/** Answers 409 with a plain reason when the session has no terminal to type into. */
async function typeInto(send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    if (error instanceof SessionNotRunningError) throw new HttpError("conflict", error.message);
    throw error;
  }
}
