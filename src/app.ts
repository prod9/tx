// Composition and the per-request context: docs/spec/app.md

import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { Bindings, TxEnv } from "./context.ts";
import { renderError } from "./errors.ts";

export function createApp<B extends Bindings = Bindings>(): Hono<TxEnv<B>> {
  const app = new Hono<TxEnv<B>>();
  app.use(async (c, next) => {
    c.set("ctx", { env: c.env, db: drizzle(c.env.DB) });
    await next();
  });
  app.onError(renderError);

  return app;
}

export function fragment<B extends Bindings = Bindings>(): Hono<TxEnv<B>> {
  return new Hono<TxEnv<B>>();
}
