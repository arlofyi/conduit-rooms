import { timingSafeEqual } from "node:crypto";
import { serve, type ServerType } from "@hono/node-server";
import type { ApiErrorBody } from "@rooms/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "./context";
import { HttpError } from "./errors";
import { agentRoutes } from "./routes/agents";
import { artifactRoutes } from "./routes/artifacts";
import { appRoutes } from "./routes/app";
import { conversationRoutes } from "./routes/conversations";
import { productRoutes } from "./routes/products";
import { projectRoutes } from "./routes/projects";
import { roomRoutes } from "./routes/rooms";
import { sessionRoutes } from "./routes/sessions";

export const TOKEN_HEADER = "x-rooms-token";

/**
 * The sidecar's HTTP API.
 *
 * It listens on 127.0.0.1 only, but any page open in a browser can reach
 * localhost. So every request must carry the token written at boot, and a
 * request from a web origin other than the app's own is refused outright.
 */
export function createApp(ctx: AppContext): Hono {
  const app = new Hono();

  // The built app's webview is a different origin from 127.0.0.1, so it needs CORS.
  app.use(cors({ origin: ctx.config.allowedOrigins, allowHeaders: ["content-type", TOKEN_HEADER], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));

  app.use(async (c, next) => {
    const origin = c.req.header("origin");
    if (origin && !ctx.config.allowedOrigins.includes(origin)) {
      throw new HttpError("unauthorized", "This origin may not call the sidecar.");
    }
    if (!tokensMatch(c.req.header(TOKEN_HEADER), ctx.token)) {
      throw new HttpError("unauthorized", "Missing or wrong sidecar token.");
    }
    await next();
  });

  app.route("/", appRoutes(ctx));
  app.route("/", projectRoutes(ctx));
  app.route("/", agentRoutes(ctx));
  app.route("/", artifactRoutes(ctx));
  app.route("/", productRoutes(ctx));
  app.route("/", roomRoutes(ctx));
  app.route("/", sessionRoutes(ctx));
  app.route("/", conversationRoutes(ctx));

  app.notFound((c) =>
    c.json<ApiErrorBody>({ error: { code: "not_found", message: "No such route." } }, 404),
  );

  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json(error.toBody(), error.status);

    console.error(`[sidecar] ${c.req.method} ${c.req.path} failed:`, error);
    return c.json<ApiErrorBody>(
      { error: { code: "internal", message: "Something went wrong in the sidecar." } },
      500,
    );
  });

  return app;
}

function tokensMatch(given: string | undefined, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Listens on the configured port. The port is fixed, not searched for,
 * because the app's dev proxy has to know it before the sidecar is running.
 */
export function listen(app: Hono, port: number): Promise<ServerType> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port });

    server.once("listening", () => resolve(server));
    server.once("error", (error: NodeJS.ErrnoException) =>
      reject(
        error.code === "EADDRINUSE"
          ? new Error(`Port ${port} is taken. Is another sidecar running? Set ROOMS_SIDECAR_PORT to use a different one.`)
          : error,
      ),
    );
  });
}
