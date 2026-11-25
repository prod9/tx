import { env } from "cloudflare:workers";
import * as D1Client from "@effect/sql-d1/D1Client";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { describe, expect, it } from "vitest";
import { methodGroup } from "../src/json-rpc.ts";
import { answerer, type Handlers } from "../src/server.ts";
import { answerHttp, bearerToken, unauthorized, worker } from "../src/worker.ts";

// The Worker entry over Effect's HttpRouter, config from env, and D1 through
// @effect/sql-d1: docs/spec/worker.md

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

const routes = Layer.mergeAll(
  HttpRouter.add("POST", "/rpc", (request) => answerHttp(request, answer, 204)),
  HttpRouter.add(
    "GET",
    "/go/:slug",
    HttpRouter.params.pipe(
      Effect.map((params) =>
        HttpServerResponse.redirect(`https://example.com/${params.slug ?? ""}`, { status: 302 }),
      ),
    ),
  ),
  HttpRouter.add("GET", "/private", (request) =>
    Effect.succeed(
      Option.isSome(bearerToken(request)) ? HttpServerResponse.text("ok") : unauthorized(),
    ),
  ),
);

const app = worker(routes.pipe(HttpRouter.provideRequest(D1Client.layer({ db: env.DB }))));

function fetchApp(path: string, init: RequestInit = {}): Promise<Response> {
  return app.fetch(new Request(`https://app${path}`, init));
}

function rpc(method: string, params: unknown): Promise<Response> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  return fetchApp("/rpc", { method: "POST", body });
}

function notify(method: string, params: unknown): Promise<Response> {
  const body = JSON.stringify({ jsonrpc: "2.0", method, params });
  return fetchApp("/rpc", { method: "POST", body });
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

  it("serves plain HTTP routes beside JSON-RPC", async () => {
    const res = await fetchApp("/go/abc", { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/abc");
  });

  it("answers a path no route matches with 404", async () => {
    expect((await fetchApp("/nowhere")).status).toBe(404);
  });

  it("reads a bearer token, answering 401 without one", async () => {
    const anonymous = await fetchApp("/private");
    const signedIn = await fetchApp("/private", { headers: { authorization: "Bearer abc" } });

    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("www-authenticate")).toBe("Bearer");
    expect(signedIn.status).toBe(200);
  });
});
