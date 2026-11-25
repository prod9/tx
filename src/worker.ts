// The Worker entry: docs/spec/worker.md. It routes POST requests by path to endpoints,
// provides the app's services from `env`, and resolves Effect `Config` from `env`.

import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";

export type Endpoint<R> = (request: Request) => Effect.Effect<Response, never, R>;

export const worker = <Env extends object, R, E>(options: {
  readonly endpoints: Readonly<Record<string, Endpoint<R>>>;
  readonly layer: (env: Env) => Layer.Layer<R, E>;
}) => ({
  fetch: async (request: Request, env: Env): Promise<Response> => {
    const endpoint = options.endpoints[new URL(request.url).pathname];

    if (endpoint === undefined) return new Response(null, { status: 404 });
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { allow: "POST" } });
    }

    return endpoint(request).pipe(
      Effect.provide(options.layer(env)),
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
      Effect.runPromise,
    );
  },
});

// The HTTP response for a JSON-RPC answer: the reply as JSON, or `noReplyStatus` when every
// message was a notification (204 for plain JSON-RPC, 202 for MCP Streamable HTTP).
export const replyResponse = (reply: Option.Option<string>, noReplyStatus: 202 | 204): Response =>
  Option.match(reply, {
    onNone: () => new Response(null, { status: noReplyStatus }),
    onSome: (text) => new Response(text, { headers: { "content-type": "application/json" } }),
  });

export const bearerToken = (request: Request): Option.Option<string> => {
  const match = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  return Option.fromNullishOr(match?.[1]);
};

export const unauthorized = (): Response =>
  new Response(null, { status: 401, headers: { "www-authenticate": "Bearer" } });
