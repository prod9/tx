# JSON-RPC

**Status:** implemented

JSON-RPC 2.0 (https://www.jsonrpc.org/specification) implemented on Effect `Schema`,
including its standard error codes. tx's own layer, not `effect/rpc`.

| Module                 | Holds                                                  | Runs in         |
|------------------------|--------------------------------------------------------|-----------------|
| `@prod9/tx/json-rpc`   | envelopes, `ErrorCode`, `Method`, `methodGroup`        | anywhere        |
| `@prod9/tx/server`     | `answerer`, `Handlers`, `HandlerServices`              | the API Worker  |
| `@prod9/tx/client`     | `call`, `CallError`, `HttpStatusError`                 | anywhere        |

The contract modules (`json-rpc`, `client`, `mcp`) import nothing from Workers, so a
frontend and a backend share one contract package of method groups.

## Method groups

A method group maps each method name to its `params` and `result` schemas:

```ts
export const ProjectMethods = methodGroup({
  "projects.show": {
    params: Schema.Struct({ projectId: ProjectId }),
    result: ProjectSummary,
  },
});
```

Params encode to an object (by name) or an array (by position), the two forms the
specification admits.

## Server

`answerer(group, handlers)` returns a function from an HTTP body's text to the reply's
text, or `Option.none()` when every message was a notification.

- A handler takes decoded params and returns an `Effect` of the decoded result. It fails
  with a JSON-RPC `ErrorObject`, which the caller receives as is.
- The services a handler needs (`R`) are inferred per handler and merged
  (`HandlerServices`); the endpoint provides them, for example the caller's session.
- Params that fail their schema answer `InvalidParams` (-32602); an unknown method
  `MethodNotFound` (-32601); unparsable JSON `ParseError` (-32700) with a null id; a
  message that is not a request, or an empty batch, `InvalidRequest` (-32600).
- A batch is answered as a batch, in order, without replies for its notifications.
- A defect answers `InternalError` (-32603) and is logged with `Effect.logError`; its
  message never reaches the caller. A failed notification logs a warning.
- Results encode through their schema; a result that fails it is a defect.

## Client

`call(endpoint, group, name, params)` encodes params, POSTs the request, and decodes the
result. `endpoint` is `{ fetcher, url, headers? }`; the fetcher is anything with
`fetch(url, init)`: a service binding, or `globalThis`.

| Outcome                               | Effect                                     |
|---------------------------------------|--------------------------------------------|
| the server answered a result          | succeeds with the decoded result           |
| the server answered a JSON-RPC error  | fails with `CallError` holding the error   |
| the HTTP status is not 2xx (e.g. 401) | fails with `HttpStatusError` and `status`  |
| a schema or id mismatch               | dies: the contract was broken              |

An app maps these to its own outcomes, such as a 401 meaning the session ended.
