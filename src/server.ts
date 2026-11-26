// The JSON-RPC 2.0 server: docs/spec/json-rpc.md. It answers the raw text of an HTTP body
// with the raw text of the reply, or with nothing when every message in the body was a
// notification.

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as JsonRpc from "./json-rpc";

// A handler fails with the JSON-RPC error its caller receives; it needs services `R`, such
// as the caller's identity, that the endpoint provides.
export type Handlers<Group extends JsonRpc.MethodGroup<Group>, R = never> = {
  readonly [Name in keyof Group]: (
    params: Group[Name]["params"]["Type"],
  ) => Effect.Effect<Group[Name]["result"]["Type"], JsonRpc.ErrorObject, R>;
};

// The services a set of handlers needs, together.
export type HandlerServices<H> = {
  readonly [Name in keyof H]: H[Name] extends (
    params: never,
  ) => Effect.Effect<unknown, unknown, infer R>
    ? R
    : never;
}[keyof H];

// `H` is the handler record's own type, so `R` is the union of what each handler needs;
// a single `R` parameter would not infer across several handlers.
// biome-ignore lint/suspicious/noExplicitAny: generic constraint, every handler's R is accepted
export const answerer = <Group extends JsonRpc.MethodGroup<Group>, H extends Handlers<Group, any>>(
  group: Group,
  handlers: H,
) => {
  type R = HandlerServices<H>;

  const dispatch = (request: JsonRpc.Request): Effect.Effect<unknown, JsonRpc.ErrorObject, R> =>
    isMethodOf(group, request.method)
      ? invoke(group, handlers, request.method, request.params)
      : Effect.fail(error(JsonRpc.ErrorCode.MethodNotFound, `Method not found: ${request.method}`));

  const answerMessage = (message: unknown): Effect.Effect<Option.Option<JsonRpc.Reply>, never, R> =>
    decodeRequest(message).pipe(
      Effect.matchEffect({
        onFailure: () => Effect.succeed(Option.some(failure(null, invalidRequest))),
        onSuccess: (request) => answerRequest(dispatch, request),
      }),
    );

  const answerBatch = (
    messages: ReadonlyArray<unknown>,
  ): Effect.Effect<Option.Option<Answer>, never, R> =>
    messages.length === 0
      ? Effect.succeed(Option.some(failure(null, invalidRequest)))
      : Effect.forEach(messages, answerMessage).pipe(
          Effect.map(Arr.getSomes),
          Effect.map((replies) => (replies.length === 0 ? Option.none() : Option.some(replies))),
        );

  return (body: string): Effect.Effect<Option.Option<string>, never, R> =>
    decodeJson(body).pipe(
      Effect.matchEffect({
        onFailure: () => Effect.succeed(Option.some<Answer>(failure(null, parseError))),
        onSuccess: (message) =>
          Array.isArray(message) ? answerBatch(message) : answerMessage(message),
      }),
      Effect.map(Option.map((reply) => JSON.stringify(reply))),
    );
};

// dispatch

const isMethodOf = <Group extends JsonRpc.MethodGroup<Group>>(
  group: Group,
  name: string,
): name is Extract<keyof Group, string> => Object.hasOwn(group, name);

const invoke = <
  Group extends JsonRpc.MethodGroup<Group>,
  // biome-ignore lint/suspicious/noExplicitAny: generic constraint, as in `answerer`
  H extends Handlers<Group, any>,
  Name extends keyof Group,
>(
  group: Group,
  handlers: H,
  name: Name,
  params: unknown,
): Effect.Effect<unknown, JsonRpc.ErrorObject, HandlerServices<H>> => {
  const method = group[name];
  const handler = handlers[name];

  return Schema.decodeUnknownEffect(method.params)(params).pipe(
    Effect.mapError((issue) => error(JsonRpc.ErrorCode.InvalidParams, issue.message)),
    Effect.flatMap(handler),
    Effect.flatMap((result) => Schema.encodeEffect(method.result)(result).pipe(Effect.orDie)),
  );
};

const answerRequest = <R>(
  dispatch: (request: JsonRpc.Request) => Effect.Effect<unknown, JsonRpc.ErrorObject, R>,
  request: JsonRpc.Request,
): Effect.Effect<Option.Option<JsonRpc.Reply>, never, R> => {
  // The caller learns only that the call failed; the defect itself goes to the log.
  const outcome = dispatch(request).pipe(
    Effect.catchDefect((defect) =>
      Effect.logError(`JSON-RPC method ${request.method} failed`, defect).pipe(
        Effect.andThen(Effect.fail(internalError)),
      ),
    ),
  );

  if (request.id === undefined) {
    const notified = outcome.pipe(
      Effect.ignore({ log: "Warn", message: `JSON-RPC notification ${request.method} failed` }),
    );
    return notified.pipe(Effect.as(Option.none()));
  }

  const id = request.id;
  return outcome.pipe(
    Effect.match({
      onFailure: (cause) => Option.some(failure(id, cause)),
      onSuccess: (result) => Option.some(success(id, result)),
    }),
  );
};

// messages

// A body holds one message or a batch, and is answered in the same form.
type Answer = JsonRpc.Reply | ReadonlyArray<JsonRpc.Reply>;

type ErrorCode = (typeof JsonRpc.ErrorCode)[keyof typeof JsonRpc.ErrorCode];

const decodeJson = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));
const decodeRequest = Schema.decodeUnknownEffect(JsonRpc.Request);

const error = (code: ErrorCode, message: string): JsonRpc.ErrorObject => ({ code, message });

const parseError = error(JsonRpc.ErrorCode.ParseError, "Parse error");
const invalidRequest = error(JsonRpc.ErrorCode.InvalidRequest, "Invalid Request");
const internalError = error(JsonRpc.ErrorCode.InternalError, "Internal error");

const success = (id: JsonRpc.RequestId, result: unknown): JsonRpc.Success => ({
  jsonrpc: "2.0",
  id,
  result,
});

const failure = (id: JsonRpc.RequestId, cause: JsonRpc.ErrorObject): JsonRpc.Failure => ({
  jsonrpc: "2.0",
  id,
  error: cause,
});
