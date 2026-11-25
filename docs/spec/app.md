# App

**Status:** implemented

Module `@prod9/tx/app`, with types in `@prod9/tx/context`.

## Composition

`createApp()` returns a Hono app with two things installed: a middleware that builds the
request's `Ctx`, and `renderError` as the error handler. `fragment()` returns a plain Hono
app typed for tx. An app mounts each fragment with Hono's own `route`:

```ts
// todos/routes.ts
export const todoRoutes = fragment()
  .post("/", (c) => executeAction(c, new CreateTodo()));

// index.ts
export default createApp().route("/todos", todoRoutes);
```

A fragment inherits the parent's middleware and error handler. Mount fragments after any
`use` on the root app, as Hono applies middleware in registration order.

## The per-request context

`Ctx` is the one per-request context (Philosophy 4):

| Field | Holds                                                 |
|-------|-------------------------------------------------------|
| `env` | the Worker's `env` bindings                           |
| `db`  | a Drizzle database over the `DB` binding (`env.DB`)   |

Routes read it as `c.var.ctx`; `executeAction` passes it to `execute`. The D1 binding is
named `DB` by convention. An app with more bindings types them once and passes the type to
`createApp<MyBindings>()`, `fragment<MyBindings>()` and `Ctx<MyBindings>`.

Request-scoped values a route resolves (a path parameter, the signed-in user) reach an
action as constructor arguments, not through `Ctx`.
