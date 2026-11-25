# Worker

**Status:** implemented

`@prod9/tx/worker` is a Worker's entry: it maps paths to endpoints, provides the app's
services from `env`, and resolves Effect `Config` from `env`.

```ts
const answer = answerer(AppMethods, appHandlers);

export default worker<Env, SqlClient.SqlClient, unknown>({
  endpoints: {
    "/rpc": (request) =>
      Effect.gen(function* () {
        const body = yield* Effect.promise(() => request.text());
        return replyResponse(yield* answer(body), 204);
      }),
  },
  layer: (env) => D1Client.layer({ db: env.DB }),
});
```

## Routing

| Request                        | Response                                  |
|--------------------------------|-------------------------------------------|
| a path not in `endpoints`      | 404                                       |
| an endpoint path, not POST     | 405 with `allow: POST`                    |
| an endpoint path, POST         | the endpoint's `Response`                 |

Protocols outside JSON-RPC (git hosting, OAuth callbacks that need GET, asset serving)
are the app's own `fetch` code; tx does not route them.

## Services and config

- `layer(env)` builds the services every endpoint needs, per request.
- `ConfigProvider.fromUnknown(env)` is provided under it, so `Config.String("NAME")` and
  the other Effect `Config` declarations read the Worker's vars and secrets, inside
  handlers and inside the layer (for example `D1Client.layerConfig`).
- A layer that fails rejects the request, and the Workers runtime answers 500 and logs it.

## Helpers

| Function                            | Does                                                          |
|-------------------------------------|---------------------------------------------------------------|
| `replyResponse(reply, status)`      | the reply as JSON, or `status` (204, or 202 for MCP) if none  |
| `bearerToken(request)`              | the `Authorization: Bearer` token, as an `Option`             |
| `unauthorized()`                    | 401 with `www-authenticate: Bearer`                           |
