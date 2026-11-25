import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { describe, expect, it } from "vitest";
import { CallError, call, HttpStatusError } from "../src/client.ts";
import { answerer } from "../src/server.ts";
import { DivisionByZero, MathMethods, mathHandlers } from "./methods.ts";

// The client side of JSON-RPC: docs/spec/json-rpc.md, "Client"

const answer = answerer(MathMethods, mathHandlers);

// Stands in for a service binding: answers with the server, behind a bearer token.
const api = {
  async fetch(_url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    if (headers.get("authorization") !== "Bearer letmein")
      return new Response(null, { status: 401 });

    const text = await Effect.runPromise(answer(String(init.body)));
    return Option.match(text, {
      onNone: () => new Response(null, { status: 204 }),
      onSome: (body) => new Response(body, { headers: { "content-type": "application/json" } }),
    });
  },
};

const endpoint = {
  fetcher: api,
  url: "https://api/rpc",
  headers: { authorization: "Bearer letmein" },
};

describe("call", () => {
  it("encodes params, posts the request, and decodes the result", async () => {
    const result = await Effect.runPromise(call(endpoint, MathMethods, "math.add", { a: 2, b: 3 }));

    expect(result).toBe(5);
  });

  it("fails with CallError carrying the JSON-RPC error", async () => {
    const exit = await Effect.runPromiseExit(
      call(endpoint, MathMethods, "math.divide", { a: 1, b: 0 }),
    );

    expect(exit).toEqual(
      Exit.fail(new CallError({ code: DivisionByZero, message: "division by zero" })),
    );
  });

  it("fails with HttpStatusError when the endpoint answers outside JSON-RPC", async () => {
    const anonymous = { fetcher: api, url: "https://api/rpc" };
    const exit = await Effect.runPromiseExit(
      call(anonymous, MathMethods, "math.add", { a: 1, b: 1 }),
    );

    expect(exit).toEqual(Exit.fail(new HttpStatusError({ status: 401 })));
  });
});
