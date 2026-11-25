# Philosophy

**Status:** accepted

tx rebuilds fx (`fx.prodigy9.co`, the PRODIGY9 Go API framework) for Cloudflare Workers
backed by D1. It inherits fx's eight principles (fx `docs/spec/philosophy.md`); the list
in `AGENTS.md` restates them for Workers and is the design-intent test for every change.
This file records how each fx idea carries over.

chakrit, 2026-11-25: "a rebuild in the likeness of fx, basically inherit as much of the
philosophy as make sense / keep to the basic features that allow us to work w cf workers /
focus on d1, cf workers deployment purely (or, at maximum, other similar serverless setup)
/ use the action pattern / use the config pattern".

## Kept

| fx                                          | tx                                                        |
|---------------------------------------------|-----------------------------------------------------------|
| App fragments mounted by `app.Build()`      | Hono sub-apps from `fragment()`, mounted on `createApp()` |
| Controllers wrapping a chi router           | Hono routes; Hono stays the router you write against      |
| `config.StrDef` declarations, `config.Get`  | `strDef` declarations, `get(env, var)` over Workers `env` |
| `context.Context` carrying config and DB    | `Ctx` carrying `env` and the Drizzle database             |
| Actions: `Validate()` and `Execute(ctx)`    | Actions: `validate()` and `execute(ctx)`                  |
| `validate` package returning field errors   | `validate` module with the same JSON shape                |
| `render.Error` with `code`/`message`/`data` | `renderError` with the same JSON shape                    |

## Changed

- **Database.** Drizzle ORM over D1 replaces fx's raw-SQL `sqlx` layer, by chakrit's
  ruling (see `AGENTS.md`, Stack). D1 has no interactive transactions, so writes that
  must succeed together go in one `db.batch([...])`; there are no transaction scopes.
- **Configuration sources.** Workers have no process environment and no files, so values
  come only from the `env` bindings of the current request. There are no `.env` files,
  `config.Set`, or `SetDefault` at runtime; tests pass the `env` they need.
- **Unexpected errors.** fx renders every error's message. tx renders unknown errors as
  a generic 500 and logs them, since a Worker's response is public (see `errors.md`).

## Dropped

fx's background workers, pubsub, Redis cache, mailer, blob store, cobra CLI and Postgres
support. Cloudflare provides Queues, Cron Triggers, R2 and Email for the first four; a
Worker has no CLI; D1 is the database.
