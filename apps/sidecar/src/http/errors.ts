import type { ApiErrorBody, ApiErrorCode } from "@rooms/shared";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const STATUS: Record<ApiErrorCode, ContentfulStatusCode> = {
  invalid_request: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 409,
  internal: 500,
};

/** Thrown by a route to answer with a known error. Anything else thrown becomes a 500. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = STATUS[code];
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

export const notFound = (what: string) => new HttpError("not_found", `${what} was not found.`);
export const invalid = (message: string) => new HttpError("invalid_request", message);
