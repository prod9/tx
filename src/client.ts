// The client side of JSON-RPC 2.0: docs/spec/json-rpc.md, "Client". Browser-safe: it
// needs only an object with `fetch`, such as a service binding or `globalThis`.

import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as JsonRpc from "./json-rpc";

export interface Endpoint {
  readonly fetcher: { fetch(url: string, init: RequestInit): Promise<Response> };
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
}

// The server answered the call with a JSON-RPC error.
export class CallError extends Data.TaggedError("CallError")<JsonRpc.ErrorObject> {}

// The endpoint answered with an HTTP status outside JSON-RPC, such as 401.
export class HttpStatusError extends Data.TaggedError("HttpStatusError")<{
  readonly status: number;
}> {}

export const call = <
  Group extends JsonRpc.MethodGroup<Group>,
  Name extends Extract<keyof Group, string>,
>(
  endpoint: Endpoint,
  group: Group,
  name: Name,
  params: Group[Name]["params"]["Type"],
): Effect.Effect<Group[Name]["result"]["Type"], CallError | HttpStatusError> => {
  const method = group[name];
  const id = crypto.randomUUID();

  // A params or result value that fails its schema is a contract breach, not an outcome
  // the caller handles.
  const encodeParams = Schema.encodeEffect(method.params)(params).pipe(Effect.orDie);
  const decodeResult = (result: unknown) =>
    Schema.decodeUnknownEffect(method.result)(result).pipe(Effect.orDie);

  return encodeParams.pipe(
    Effect.flatMap((encoded) =>
      post(endpoint, { jsonrpc: "2.0", id, method: name, params: encoded }),
    ),
    Effect.flatMap((reply) =>
      reply.id === id ? Effect.succeed(reply) : Effect.die(mismatchedId(id, reply.id)),
    ),
    Effect.flatMap((reply) =>
      "error" in reply ? Effect.fail(new CallError(reply.error)) : decodeResult(reply.result),
    ),
  );
};

const mismatchedId = (sent: string, received: JsonRpc.RequestId) =>
  new Error(`Reply id ${String(received)} does not match request id ${sent}`);

const decodeReply = Schema.decodeUnknownEffect(Schema.fromJsonString(JsonRpc.Reply));

const post = (
  endpoint: Endpoint,
  request: JsonRpc.Request,
): Effect.Effect<JsonRpc.Reply, HttpStatusError> => {
  const init = {
    method: "POST",
    headers: { ...endpoint.headers, "content-type": "application/json" },
    body: JSON.stringify(request),
  };

  return Effect.promise(() => endpoint.fetcher.fetch(endpoint.url, init)).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.promise(() => response.text()).pipe(Effect.flatMap(decodeReply), Effect.orDie)
        : Effect.fail(new HttpStatusError({ status: response.status })),
    ),
  );
};
