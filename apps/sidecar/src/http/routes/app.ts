import {
  API_PREFIX,
  type HealthResponse,
  type SaveUiStateRequest,
  type UiStateResponse,
  type WorkspaceEvent,
} from "@rooms/shared";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { getUiState, saveUiState } from "../../store/uiState";
import type { AppContext } from "../context";
import { invalid } from "../errors";

const uiStatePatch = z.object({
  lastView: z.string().max(200).nullable().optional(),
}) satisfies z.ZodType<SaveUiStateRequest>;

/** Keeps proxies and the webview from closing an idle stream. */
const HEARTBEAT_MS = 20_000;

/** Routes about the app itself rather than any one conversation. */
export function appRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  app.get(`${API_PREFIX}/health`, (c) =>
    c.json<HealthResponse>({ ok: true, leadAuth: ctx.config.leadAuth }),
  );

  app.get(`${API_PREFIX}/ui-state`, (c) =>
    c.json<UiStateResponse>({ uiState: getUiState(ctx.db) }),
  );

  app.patch(`${API_PREFIX}/ui-state`, async (c) => {
    const parsed = uiStatePatch.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw invalid("Invalid UI state.");

    return c.json<UiStateResponse>({ uiState: saveUiState(ctx.db, parsed.data) });
  });

  /** The live feed of every conversation. Open for as long as the app is. */
  app.get(`${API_PREFIX}/events`, (c) =>
    streamSSE(c, async (stream) => {
      const send = (event: WorkspaceEvent) =>
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });

      const unsubscribe = ctx.bus.subscribe(send);
      const heartbeat = setInterval(() => void stream.write(": ping\n\n"), HEARTBEAT_MS);

      await new Promise<void>((resolve) => stream.onAbort(resolve));

      clearInterval(heartbeat);
      unsubscribe();
    }),
  );

  return app;
}
