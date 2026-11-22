import type { ApiErrorBody, ApiErrorCode } from "@rooms/shared";

/**
 * The one way the app talks to the sidecar. Every hook in this folder goes
 * through request(), so auth, errors and the base URL are handled in one place.
 */

/** The sidecar answered, and the answer was an error. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The sidecar did not answer at all: it is not running, or it is restarting. */
export class SidecarUnreachableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Rooms cannot reach its sidecar.", options);
    this.name = "SidecarUnreachableError";
  }
}

interface Endpoint {
  /** Prefixed to every path. Empty in development, where Vite proxies /api. */
  baseUrl: string;
  headers: Record<string, string>;
}

const DEV_ENDPOINT: Endpoint = { baseUrl: "", headers: {} };

let endpoint: Promise<Endpoint> | undefined;

/**
 * Where the sidecar is. In development the Vite proxy forwards /api and adds
 * the token (vite.config.ts). In the built app the shell reads the sidecar's
 * runtime file and hands over its port and token.
 */
function resolveEndpoint(): Promise<Endpoint> {
  if (import.meta.env.DEV) return Promise.resolve(DEV_ENDPOINT);

  endpoint ??= import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke<{ port: number; token: string }>("sidecar_endpoint"))
    .then(({ port, token }) => ({
      baseUrl: `http://127.0.0.1:${port}`,
      headers: { "x-rooms-token": token },
    }));

  return endpoint;
}

/** fetch() against the sidecar. Rejects with SidecarUnreachableError when nothing answers. */
export async function sidecarFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { baseUrl, headers } = await resolveEndpoint().catch((cause) => {
    endpoint = undefined;
    throw new SidecarUnreachableError({ cause });
  });

  try {
    return await fetch(baseUrl + path, { ...init, headers: { ...headers, ...init.headers } });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new SidecarUnreachableError({ cause });
  }
}

/** Calls a JSON route and returns its body, or throws ApiError with the sidecar's own message. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await sidecarFetch(path, {
    ...init,
    headers: init.body ? { "content-type": "application/json", ...init.headers } : init.headers,
  });

  // The dev proxy answers 502 or 504 itself when the sidecar is down.
  if (response.status === 502 || response.status === 504) throw new SidecarUnreachableError();
  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      error?.code ?? "internal",
      error?.message ?? "The sidecar returned an error it did not explain.",
      response.status,
    );
  }

  return body as T;
}

export const getJson = <T>(path: string) => request<T>(path);

export const sendJson = <T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
