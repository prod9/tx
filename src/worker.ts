// The Worker entry: docs/spec/worker.md. An app's routes are an Effect HttpRouter layer;
// JSON-RPC endpoints are `rpcRoute`s answered by `answerHttp`. Effect `Config` reads the
// Worker's env.

import { env } from "cloudflare:workers";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import type * as HttpServerError from "effect/http/HttpServerError";
import type * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

// The routes of an app, with every service its handlers need already provided per request
// (`HttpRouter.provideRequest`). A route whose services are missing does not type-check.
export type Routes<E, RouteError> = Layer.Layer<
  never,
  E,
  HttpRouter.HttpRouter | HttpRouter.Request<"Error", RouteError>
>;

// Builds the handler once, at module scope, as Effect requires on Workers: a fiber
// started inside `fetch` would capture that request's async context. Layers take their
// bindings from `env` in `cloudflare:workers`.
export const worker = <E, RouteError>(app: Routes<E, RouteError>) => {
  const configured = app.pipe(
    Layer.provide(HttpServer.layerServices),
    Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
  );
  const web = HttpRouter.toWebHandler(configured);

  return { fetch: (request: Request): Promise<Response> => web.handler(request) };
};

// A JSON-RPC endpoint: `post` answers POST, and every other method answers 405 with
// `Allow: POST`, which MCP Streamable HTTP requires of a server with no SSE stream. One
// wildcard route, because a POST route beside a wildcard one on the same path collides.
export const rpcRoute = <E, R>(
  path: HttpRouter.PathInput,
  post: (
    request: HttpServerRequest.HttpServerRequest,
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  HttpRouter.add("*", path, (request) =>
    request.method === "POST" ? post(request) : Effect.succeed(methodNotAllowed),
  );

const methodNotAllowed = HttpServerResponse.empty({ status: 405, headers: { allow: "POST" } });

// Answers a JSON-RPC request body: the reply as JSON, or `noReplyStatus` when every
// message was a notification (204 for plain JSON-RPC, 202 for MCP Streamable HTTP).
export const answerHttp = <R>(
  request: HttpServerRequest.HttpServerRequest,
  answer: (body: string) => Effect.Effect<Option.Option<string>, never, R>,
  noReplyStatus: 202 | 204,
): Effect.Effect<HttpServerResponse.HttpServerResponse, HttpServerError.HttpServerError, R> =>
  request.text.pipe(
    Effect.flatMap(answer),
    Effect.map(
      Option.match({
        onNone: () => HttpServerResponse.empty({ status: noReplyStatus }),
        onSome: (text) => HttpServerResponse.text(text, { contentType: "application/json" }),
      }),
    ),
  );

export const bearerToken = (
  request: HttpServerRequest.HttpServerRequest,
): Option.Option<string> => {
  const match = /^Bearer (\S+)$/.exec(request.headers.authorization ?? "");
  return Option.fromNullishOr(match?.[1]);
};

export const unauthorized = (): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.empty({ status: 401, headers: { "www-authenticate": "Bearer" } });
