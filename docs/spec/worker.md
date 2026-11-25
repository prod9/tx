# Worker

**Status:** implemented

`@prod9/tx/worker` is a Worker's entry over Effect's own router (`effect/http`
`HttpRouter`). An app's routes are an `HttpRouter` layer: JSON-RPC endpoints and plain
HTTP routes (redirects, uploads, OAuth callbacks, webhooks) side by side.

```ts
import { env } from "cloudflare:workers";

const answer = answerer(AppMethods, appHandlers);

const routes = Layer.mergeAll(
  HttpRouter.add("POST", "/rpc", (request) => answerHttp(request, answer, 204)),
  HttpRouter.add("GET", "/:slug", redirectToTarget),
);

export default worker(routes.pipe(HttpRouter.provideRequest(D1Client.layer({ db: env.DB }))));
```

## Building

- `worker(routes)` builds the handler once, at module scope. Effect requires this on
  Workers: a fiber started inside `fetch` would capture that request's async context.
  Bindings come from `env` in `cloudflare:workers`, not from `fetch`'s arguments.
- Provide the services route handlers need with `HttpRouter.provideRequest(layer)`, which
  builds them per request (Philosophy 4). `worker` takes only routes whose services are
  all provided, so a missing service is a type error, not a runtime "Service not found".
- `ConfigProvider.fromUnknown(env)` is provided under the routes, so `Config.String("NAME")`
  and the other Effect `Config` declarations read the Worker's vars and secrets.
- A path no route matches answers 404 (Effect's router).

`HttpRouter` is marked unstable in Effect 4; pin Effect and read its changelog on upgrade.

## Helpers

| Function                                 | Does                                                                 |
|------------------------------------------|----------------------------------------------------------------------|
| `answerHttp(request, answer, status)`    | answers a JSON-RPC body; `status` (204, or 202 for MCP) if no reply  |
| `bearerToken(request)`                   | the `Authorization: Bearer` token, as an `Option`                    |
| `unauthorized()`                         | 401 with `www-authenticate: Bearer`                                  |
