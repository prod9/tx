// Error shape and rendering: docs/spec/errors.md

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { type Fields, ValidationError } from "./validate.ts";

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function notFound(): HttpError {
  return new HttpError(404, "not_found", "not found");
}

export function unauthorized(): HttpError {
  return new HttpError(401, "unauthorized", "unauthorized");
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, "bad_request", message);
}

interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly data?: Fields;
}

export function renderError(err: Error, c: Context): Response {
  if (err instanceof ValidationError) {
    return c.json<ErrorBody>({ code: "validation", message: err.message, data: err.fields }, 400);
  }
  if (err instanceof HttpError) {
    return c.json<ErrorBody>({ code: err.code, message: err.message }, err.status);
  }
  if (err instanceof HTTPException) return err.getResponse();

  console.error(`${c.req.method} ${c.req.path}:`, err);
  return c.json<ErrorBody>({ code: "internal", message: "internal server error" }, 500);
}
