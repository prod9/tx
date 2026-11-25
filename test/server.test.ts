import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { describe, expect, it } from "vitest";
import { ErrorCode } from "../src/json-rpc.ts";
import { answerer } from "../src/server.ts";
import { DivisionByZero, Greeting, TestMethods, testHandlers } from "./methods.ts";

// JSON-RPC 2.0 behaviour: docs/spec/json-rpc.md, https://www.jsonrpc.org/specification

const answer = answerer(TestMethods, testHandlers);

async function reply(body: string): Promise<unknown> {
  const text = await Effect.runPromise(answer(body).pipe(Effect.provideService(Greeting, "hi")));
  return Option.match(text, { onNone: () => undefined, onSome: (json) => JSON.parse(json) });
}

function request(method: string, params: unknown, id = 1): string {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

function notification(method: string, params: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", method, params });
}

describe("answerer", () => {
  it("answers a call with its encoded result", async () => {
    expect(await reply(request("math.add", { a: 1, b: 2 }))).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: 3,
    });
  });

  it("passes a handler's JSON-RPC error to the caller", async () => {
    expect(await reply(request("math.divide", { a: 1, b: 0 }, 7))).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: DivisionByZero, message: "division by zero" },
    });
  });

  it("provides the services handlers need", async () => {
    expect(await reply(request("greet", {}))).toMatchObject({ result: "hi" });
  });

  it("answers an unknown method with Method not found", async () => {
    expect(await reply(request("math.pow", { a: 1, b: 2 }))).toMatchObject({
      id: 1,
      error: { code: ErrorCode.MethodNotFound },
    });
  });

  it("answers params that fail their schema with Invalid params", async () => {
    expect(await reply(request("math.add", { a: "one", b: 2 }))).toMatchObject({
      id: 1,
      error: { code: ErrorCode.InvalidParams },
    });
  });

  it("answers malformed JSON with Parse error and a null id", async () => {
    expect(await reply("{not json")).toMatchObject({
      id: null,
      error: { code: ErrorCode.ParseError },
    });
  });

  it("answers a message that is not a request with Invalid Request", async () => {
    expect(await reply(JSON.stringify({ hello: "world" }))).toMatchObject({
      id: null,
      error: { code: ErrorCode.InvalidRequest },
    });
    expect(await reply("[]")).toMatchObject({
      id: null,
      error: { code: ErrorCode.InvalidRequest },
    });
  });

  it("answers a batch in order, skipping notifications", async () => {
    const batch = `[${request("math.add", { a: 1, b: 1 }, 1)},${notification("math.add", { a: 2, b: 2 })},${request("nope", {}, 3)}]`;

    expect(await reply(batch)).toEqual([
      { jsonrpc: "2.0", id: 1, result: 2 },
      {
        jsonrpc: "2.0",
        id: 3,
        error: { code: ErrorCode.MethodNotFound, message: "Method not found: nope" },
      },
    ]);
  });

  it("gives no reply when every message is a notification", async () => {
    expect(await reply(notification("math.add", { a: 1, b: 1 }))).toBeUndefined();
  });

  it("hides a defect behind Internal error", async () => {
    const answered = await reply(request("explode", {}));

    expect(answered).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: ErrorCode.InternalError, message: "Internal error" },
    });
  });
});
