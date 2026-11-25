import type { DrizzleD1Database } from "drizzle-orm/d1";

export interface Bindings {
  readonly DB: D1Database;
}

export interface Ctx<B extends Bindings = Bindings> {
  readonly env: B;
  readonly db: DrizzleD1Database;
}

export interface TxEnv<B extends Bindings = Bindings> {
  Bindings: B;
  Variables: { ctx: Ctx<B> };
}
