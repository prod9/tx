# tx

tx is the PRODIGY9 TypeScript framework for Cloudflare Workers backed by D1. It rebuilds
the ideas of fx (`fx.prodigy9.co`, the PRODIGY9 Go API framework) for Workers and keeps
only the basic features a Workers app needs. Cloudflare Workers with D1 is the target; a
similar serverless runtime with the same `fetch` handler model is the furthest it
reaches.

Status: design settled, no code yet.

## TypeScript exception

TypeScript is allowed in this repository and in apps built on tx, as a granted exception
to the PRODIGY9 TypeScript ban and to `code · plain-js`. Do not remove TypeScript here.

- chakrit, 2026-11-25: "build it in pure typescript. use super fast runtimes/servers/etc."
- chakrit, 2026-11-25, asked whether the exception covers tx and the apps built on it:
  "yeah ignore the typescript ban"

## Stack

| Concern    | Choice                                                   | Reason                                                             |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Runtime    | workerd: Workers in prod, `wrangler dev`, tests          | Workers-only target; one runtime everywhere                        |
| Router     | Hono, as a thin layer over `Request`/`Response`          | Workers-first, web-standard; fx wraps chi the same way             |
| Database   | D1 through Drizzle ORM, the sanctioned ORM               | Native D1 and `batch()`, ~7 KB, no dependencies, SQL-shaped API    |
| Migrations | `drizzle-kit generate` SQL, `wrangler d1 migrations apply` | Each tool's own documented workflow                              |
| Tests      | Vitest with `@cloudflare/vitest-pool-workers`, local D1  | Tests run in the production runtime                                |
| Packages   | pnpm through Corepack                                    | PRODIGY9 Node default                                              |

Drizzle departs from fx's raw-SQL `sqlx` layer by ruling. chakrit, 2026-11-25: "d1
connection depart from fx a bit and add a sanctioned orm here but make sure it's insanely
fast and with api optimized for agents to quickly work on it (or if none exist, stick w
regular sql)". Measure Drizzle's bundle size and query overhead once a build exists.

Hono over Elysia by ruling. chakrit, 2026-11-25: "nah forget elysia, stick with hono".

## Philosophy

tx inherits fx's principles (fx `docs/spec/philosophy.md`). Apply them as design-intent
tests for any non-trivial change:

1. **Composition, not configuration.** Apps compose fragments: Hono sub-apps with their
   routes and middlewares, mounted by a builder. No registries, hooks, or DI container.
2. **Thin wrappers over standard primitives.** Hono, Drizzle, `Request`, `Response`, and
   the Workers `env` stay reachable. Add ergonomics, not opacity.
3. **Config as decentralized declarations.** Declare `config.strDef("NAME", "default")`
   next to the code that reads it, resolved from the Workers `env` bindings per request.
   No central config object; no `process.env`.
4. **One per-request context.** The Workers `env`, the database, and request-scoped
   state travel in one per-request context passed to the code that needs them. Do not
   add a parallel way of passing ambient values.
5. **Everything is optional.** Each module works on its own.
6. **Operations are first-class.** Every subsystem answers "how do I debug this in
   production?" before it ships.
7. **Leave distributed-systems problems to the platform.** Cloudflare owns scaling,
   retries, and transport; document the assumption instead of absorbing it.
8. **One recommended path, a few escape hatches.** Reject pluggable-everything designs.

## Patterns

- **Action.** An action is an object with `validate()` and `execute(ctx)`. A route calls
  `executeAction`, which reads the request into the action, validates it, and executes
  it. Validation uses a small fx-style validator, not a schema library.
- **Transactions.** D1 has no interactive transactions. Group writes that must succeed
  together in one `db.batch([...])`. There are no fx-style transaction scopes.

## Out of scope

fx's background workers, pubsub, Redis cache, mailer, blob store, cobra CLI, and
Postgres support.

## Commands

None yet; add them with the project setup. Installs and full test suites are heavy jobs:
run them through Dagu as the project control policy directs.

## Durable docs

None yet. Scaffold `docs/` with the `ace-docs` skill when building starts; the first spec
is `docs/spec/philosophy.md`, stating what tx keeps from fx, what it drops, and why.

## Git commit convention

Format: `<scope>: <Sentence-case summary>`, imperative mood, no trailing period, no
parentheses in the scope. Scope is a module or area name (`config:`, `action:`, `data:`,
`docs:`, `root:`), or `feat:`, `fix:`, `refactor:`, `chore:` when none fits. No
co-author trailers.

## Git checkpoints

Commit coherent, completed slices autonomously after completing the checks required for
that work. Do not ask for permission to make a local commit. A local commit does not
authorize pushing, publishing, merging, releasing, deploying, or any other change to
shared or external state; each requires separate user authorization.

## ACE

ACE (https://github.com/ace-rs/ace) manages this project's agent environment; run `ace`
to start a session. Skills come from the PRODIGY9 Coding School (`prod9/school`) and are
linked into `.claude/skills/`; propose skill changes back to the school. Run `ace config`
or `ace paths` to debug configuration.
