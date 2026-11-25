import { env } from "cloudflare:test";
import * as D1Client from "@effect/sql-d1/D1Client";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { describe, expect, it } from "vitest";
import { methodGroup } from "../src/json-rpc.ts";
import { answerer, type Handlers } from "../src/server.ts";
import { bearerToken, replyResponse, unauthorized, worker } from "../src/worker.ts";

// The Worker entry, config from env, and D1 through @effect/sql-d1: docs/spec/worker.md

const Todo = Schema.Struct({ id: Schema.Number, title: Schema.String });

const AppMethods = methodGroup({
  "todos.add": { params: Schema.Struct({ title: Schema.String }), result: Todo },
  greeting: { params: Schema.Struct({}), result: Schema.String },
});

const appHandlers = {
  "todos.add": ({ title }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql`INSERT INTO todos (title) VALUES (${title}) RETURNING id, title`;
      return yield* Schema.decodeUnknownEffect(Todo)(rows[0]);
    }).pipe(Effect.orDie),
  greeting: () => Config.String("GREETING").pipe(Effect.orDie),
} satisfies Handlers<typeof AppMethods, SqlClient.SqlClient>;

const answer = answerer(AppMethods, appHandlers);

const app = worker<Cloudflare.Env, SqlClient.SqlClient, unknown>({
  endpoints: {
    "/rpc": (request) =>
      Effect.gen(function* () {
        const body = yield* Effect.promise(() => request.text());
        return replyResponse(yield* answer(body), 204);
      }),
    "/private": (request) =>
      Effect.succeed(bearerToken(request)._tag === "Some" ? new Response("ok") : unauthorized()),
  },
  layer: (bindings) => D1Client.layer({ db: bindings.DB }),
});

function post(path: string, body: string, headers: Record<string, string> = {}): Promise<Response> {
  return app.fetch(new Request(`https://app${path}`, { method: "POST", body, headers }), env);
}

function rpc(method: string, params: unknown): Promise<Response> {
  return post("/rpc", JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));
}

function notify(method: string, params: unknown): Promise<Response> {
  return post("/rpc", JSON.stringify({ jsonrpc: "2.0", method, params }));
}

describe("worker", () => {
  it("answers JSON-RPC with handlers that use D1", async () => {
    const res = await rpc("todos.add", { title: "buy milk" });

    expect(res.headers.get("content-type")).toBe("application/json");
    const body = await res.json<{ result: { id: number; title: string } }>();
    expect(body.result.title).toBe("buy milk");

    const stored = await env.DB.prepare("SELECT title FROM todos WHERE id = ?")
      .bind(body.result.id)
      .first();
    expect(stored).toEqual({ title: "buy milk" });
  });

  it("reads Config from the Worker's env", async () => {
    expect(await (await rpc("greeting", {})).json()).toMatchObject({ result: "hello" });
  });

  it("answers a body of notifications with the no-reply status", async () => {
    const res = await notify("greeting", {});

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("answers an unknown path with 404 and a non-POST with 405", async () => {
    const missing = await post("/nowhere", "{}");
    const get = await app.fetch(new Request("https://app/rpc"), env);

    expect(missing.status).toBe(404);
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
  });

  it("reads a bearer token, answering 401 without one", async () => {
    const anonymous = await post("/private", "");
    const signedIn = await post("/private", "", { authorization: "Bearer abc" });

    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("www-authenticate")).toBe("Bearer");
    expect(signedIn.status).toBe(200);
  });
});
