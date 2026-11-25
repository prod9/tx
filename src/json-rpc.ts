// JSON-RPC 2.0 envelopes, error codes and method groups, shared by servers and clients:
// docs/spec/json-rpc.md, https://www.jsonrpc.org/specification. Browser-safe: no Worker
// imports.

import * as Schema from "effect/Schema";

export const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

export const Version = Schema.Literal("2.0");

// The specification admits null but discourages it; a reply whose request id could not be
// read carries null.
export const RequestId = Schema.Union([Schema.String, Schema.Number, Schema.Null]);
export type RequestId = typeof RequestId.Type;

export const Params = Schema.Union([
  Schema.Record(Schema.String, Schema.Unknown),
  Schema.Array(Schema.Unknown),
]);

// A request without an `id` member is a notification and gets no reply.
export const Request = Schema.Struct({
  jsonrpc: Version,
  method: Schema.String,
  params: Schema.optionalKey(Params),
  id: Schema.optionalKey(RequestId),
});
export type Request = typeof Request.Type;

export const ErrorObject = Schema.Struct({
  code: Schema.Int,
  message: Schema.String,
  data: Schema.optionalKey(Schema.Unknown),
});
export type ErrorObject = typeof ErrorObject.Type;

export const Success = Schema.Struct({ jsonrpc: Version, id: RequestId, result: Schema.Unknown });
export type Success = typeof Success.Type;

export const Failure = Schema.Struct({ jsonrpc: Version, id: RequestId, error: ErrorObject });
export type Failure = typeof Failure.Type;

export const Reply = Schema.Union([Success, Failure]);
export type Reply = typeof Reply.Type;

// Method schemas decode and encode without services, so either side can run them without
// providing anything. Params encode to a by-name object or a by-position array, the two
// forms the specification admits.
export type ParamsCodec = Schema.Codec<unknown, typeof Params.Type>;
export type ResultCodec = Schema.Codec<unknown, unknown>;

export interface Method<P extends ParamsCodec, R extends ResultCodec> {
  readonly params: P;
  readonly result: R;
}

// A set of methods keyed by their JSON-RPC method name.
export type MethodGroup<Group> = {
  readonly [Name in keyof Group]: Method<ParamsCodec, ResultCodec>;
};

export const methodGroup = <const Group extends MethodGroup<Group>>(group: Group): Group => group;
