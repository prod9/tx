# Philosophy

**Status:** accepted

tx rebuilds the ideas of fx (`fx.prodigy9.co`, the PRODIGY9 Go API framework) for
Cloudflare Workers on Effect 4, D1 and JSON-RPC 2.0. It inherits fx's eight principles
(fx `docs/spec/philosophy.md`); the list in `AGENTS.md` restates them for tx and is the
design-intent test for every change. This file records how each fx idea carries over.

chakrit, 2026-11-25: "a rebuild in the likeness of fx, basically inherit as much of the
philosophy as make sense / keep to the basic features that allow us to work w cf workers /
focus on d1, cf workers deployment purely (or, at maximum, other similar serverless setup)
/ use the action pattern / use the config pattern", and later: "rethink tx in terms of
effect 4 and json rpc".

tx's plumbing comes from hangar (`ace-rs/hangar`), its first consumer, whose API was
designed this way with chakrit.

## Carried over

| fx                                       | tx                                                         |
|------------------------------------------|------------------------------------------------------------|
| App fragments mounted by a builder       | Method groups, each answered by a `Handlers` record        |
| Controllers over a chi router            | Routes on Effect's `HttpRouter`, JSON-RPC among them      |
| `config.StrDef` declarations             | Effect `Config` declarations, resolved from the Worker env |
| `context.Context` carrying config and DB | Effect services in the `R` channel, provided per request   |
| Actions: `Validate()` and `Execute()`    | Actions: classes with constructor fields and `run()`       |
| `validate` package                       | Effect `Schema`, decoded where input enters                |
| `render.Error` with a code and message   | JSON-RPC error objects; defects become Internal error      |
| `sqlx` over Postgres                     | `@effect/sql-d1` over D1                                   |

## Changed

- **Transport.** The API is JSON-RPC 2.0 over HTTP POST, not REST routes. One contract
  module of Effect Schemas serves the server, the client, and MCP.
- **Transactions.** D1 has no interactive transactions, so writes that must succeed
  together go in one D1 batch (`D1Client.batch`). There are no transaction scopes.
- **Unexpected errors.** fx renders every error's message. tx answers a defect with
  JSON-RPC Internal error and logs it, since a Worker's response is public.

## Dropped

fx's background workers, pubsub, Redis cache, mailer, blob store, cobra CLI and Postgres
support. Cloudflare provides Durable Objects, Queues, Cron Triggers, R2 and Email for what
an app needs of them; a Worker has no CLI; D1 is the database.
