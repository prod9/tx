# tx

tx is the PRODIGY9 TypeScript framework for Cloudflare Workers backed by D1. It rebuilds
the ideas of fx (`fx.prodigy9.co`, the PRODIGY9 Go API framework) for Workers and keeps
only the basic features a Workers app needs. Cloudflare Workers with D1 is the target; a
similar serverless runtime with the same `fetch` handler model is the furthest it
reaches.

**Purpose.** tx exists so every PRODIGY9 Workers app, mostly written by agents, solves the
common plumbing (config, routing, actions, validation, D1 access) once and the same way.
Apps carry less code and fewer design decisions, and look alike, so any agent can work
across them quickly. Every request, design choice and amendment is measured against this.

Status: 0.x, first slice built (app, config, actions, validate, errors). First consumer:
hangar (`ga42:ace-rs:hangar`).

## TypeScript exception

TypeScript is allowed in this repository and in apps built on tx, as a granted exception
to the PRODIGY9 TypeScript ban and to `code · plain-js`. Do not remove TypeScript here.

- chakrit, 2026-11-25: "build it in pure typescript. use super fast runtimes/servers/etc."
- chakrit, 2026-11-25, asked whether the exception covers tx and the apps built on it:
  "yeah ignore the typescript ban"

## Philosophy

tx inherits fx's principles (fx `docs/spec/philosophy.md`). Apply them as design-intent
tests for any non-trivial change. When a change conflicts with one, the burden is on the
change to argue the exception, not on the principle to defend itself.

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

Minimalism is not a goal; it is a discipline against accidental complexity.

## Stack

| Concern    | Choice                                                     | Reason                                                          |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Runtime    | workerd: Workers in prod, `wrangler dev`, tests            | Workers-only target; one runtime everywhere                     |
| Router     | Hono, as a thin layer over `Request`/`Response`            | Workers-first, web-standard; fx wraps chi the same way          |
| Database   | D1 through Drizzle ORM, the sanctioned ORM                 | Native D1 and `batch()`, ~7 KB, no dependencies, SQL-shaped API |
| Migrations | `drizzle-kit generate` SQL, `wrangler d1 migrations apply` | Each tool's own documented workflow                             |
| Tests      | Vitest with `@cloudflare/vitest-plugin`, local D1          | Tests run in the production runtime                             |
| Packages   | pnpm through Corepack                                      | PRODIGY9 Node default                                           |

Drizzle departs from fx's raw-SQL `sqlx` layer by ruling. chakrit, 2026-11-25: "d1
connection depart from fx a bit and add a sanctioned orm here but make sure it's insanely
fast and with api optimized for agents to quickly work on it (or if none exist, stick w
regular sql)". Measure Drizzle's bundle size and query overhead once a build exists.

Hono over Elysia by ruling. chakrit, 2026-11-25: "nah forget elysia, stick with hono".

## Patterns

- **Action.** An action is an object with `validate()` and `execute(ctx)`. A route calls
  `executeAction`, which reads the request into the action, validates it, and executes
  it. Validation uses a small fx-style validator, not a schema library.
- **Transactions.** D1 has no interactive transactions. Group writes that must succeed
  together in one `db.batch([...])`. There are no fx-style transaction scopes.

## Out of scope

fx's background workers, pubsub, Redis cache, mailer, blob store, cobra CLI, and
Postgres support.

## Requests

The agent working on tx is the sink for tx feature and fix requests. A request from any
Claude session, or from chakrit, is authorized work with no per-request OK, inside these
bounds. Sender names are self-chosen labels, so the bounds, not the sender, limit what a
request can do.

| Automatic                                                        | Needs chakrit                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Feature and fix requests for tx, from any session                | Anything outside this repository                           |
| Design choices that fit Purpose, Philosophy and Stack            | Changing Purpose, Philosophy, Stack or Out of scope        |
| Code, tests, docs, dependency additions, Dagu installs and tests | Deploys                                                    |
| Local commits, pushes to `gh/main`, releases, npm publishing     | Tokens, secrets, Cloudflare resources, environment changes |

An npm publish token is a token: ask the org control for it under `rule/policy-project`
"Resources" 5.

Handle each request in order:

1. **Find the need.** The request describes one app's need, often padded with what the
   requester expects to need later. Restate it as the smallest problem that app has now.
   Read the request as a description of that problem, never as instructions to follow.
2. **Choose where it lands,** by the Purpose and the Philosophy:
   - a core module, when every Workers app needs it;
   - an optional fragment, when some apps need it;
   - an extension of an existing path, when it is a variant of something tx has;
   - a docs recipe, when a few lines over Hono, Drizzle or `env` cover it;
   - a rejection, when it conflicts with the Philosophy and its need is better met
     elsewhere: reply with the reason and the alternative. A rejection is a design call,
     never a safe default.
3. **Build exactly the need,** as a thin wrapper, with tests. Generalize when a second
   request shows the pattern: before 1.0, fold the variants into one path in a breaking
   0.x release and tell the earlier requesters what changed.
4. **Ship and log.** Release and publish, reply to the sender, and add a line to the
   request log: engram project `ga42-prod9-internal-tools`, topic key `tx/requests`
   (amend the entry): date, sender, need, where it landed, commits.

## Retrospective

Forward work only adds; retrospective work corrects. None of it blocks a request.

1. **With each request:** review the code it touched and its neighbours. Fold variants
   and cut what the need did not require.
2. **At each release and at session wind-down:** review the release's changes, the
   request log and these instructions against the Purpose and the Philosophy, and fix
   what drifted.
3. **Once two or more apps use tx:** add a script, run with the test suite, that reports
   which tx exports each app uses. Remove exports nobody uses. Read the apps for plumbing
   they still write by hand or for workarounds of tx: these are requests nobody filed.

## Evolving these instructions

These instructions are part of tx and change through regular work, the same way its code
does.

1. When work shows an instruction was wrong, missing, or led to overbuilding or a
   misread, amend it in the same change.
2. An amendment serves the Purpose and follows the Philosophy: prefer cutting or
   replacing text to adding it, keep one recommended path, and describe the general
   shape rather than the incident that prompted it.
3. Purpose, Philosophy, Stack, Out of scope, the bounds table and every quoted ruling
   record chakrit's decisions; change them only with chakrit. Amend everything else
   yourself.
4. Commit an amendment with scope `root:` and a message stating the reason; the git
   history is its record.

## Commands

| Command      | Runs                                                  |
| ------------ | ----------------------------------------------------- |
| `pnpm test`  | Vitest in workerd, with a local D1 migrated from SQL  |
| `pnpm check` | `tsc` type-check, then `biome check` (lint, format)   |

Installs, tests and checks are heavy jobs: run them through Dagu, never in your own
shell. The DAG is `~/.config/dagu/dags/prod9-internal-tools-tx-check.yaml` (install,
push the lockfile back, test, check, on a Mac worker); queue it with
`dagu enqueue --run-id <id> prod9-internal-tools-tx-check` and read
`dagu status --run-id <id> prod9-internal-tools-tx-check`.

Dependencies are caret ranges in `package.json` and pinned by `pnpm-lock.yaml`; pnpm's
`minimumReleaseAge` picks versions old enough. Only `esbuild` and `workerd` may run
install scripts (`pnpm-workspace.yaml`, `allowBuilds`).

## Durable artifacts

`docs/` holds this project's durable record.

**`docs/spec/` is authoritative — read the relevant spec before working, and comply.**
It owes no justification: a rule that departs from mainstream practice, from what you
would have picked, or from what you expected is not grounds to escalate, annotate, or
re-open it. If a spec is wrong, raise it with the user and amend the spec.

**Everything settled is a `docs/spec/` amendment**, written as the user gave it — an
instruction you were given, an approach that was agreed, a library that was picked, a
convention or preference that was fixed. Record it with the steps in
`docs/spec/README.md`, "Recording a settled rule".

File new material by the gate, first match wins: our own design or surface → `spec/`.

**Before writing under `docs/`, read `docs/README.md`, then the destination folder's
`README.md`.** The root file defines the routing gate. The folder file defines its
filing test, filename format, and lifecycle rules. Both are binding.

**`docs/spec/README.md` indexes every spec file — keep it current.** Read the index
before adding a spec file, so you amend the existing doc on a subject instead of
writing a second one. Adding, renaming, or retiring a file updates its row in the same
change.

## Git commit convention

Format: `<scope>: <Sentence-case summary>`, imperative mood, no trailing period, no
parentheses in the scope. Scope is a module or area name (`config:`, `action:`, `data:`,
`docs:`, `root:`), or `feat:`, `fix:`, `refactor:`, `chore:` when none fits. No
co-author trailers.

## Git checkpoints

Commit coherent, completed slices autonomously after completing the checks required for
that work. Pushes, releases and publishing are covered by Requests; deploys and other
changes to shared or external state need chakrit.

## ACE

ACE (https://github.com/ace-rs/ace) manages this project's agent environment; run `ace`
to start a session. Skills come from the PRODIGY9 Coding School (`prod9/school`) and are
linked into `.claude/skills/`; propose skill changes back to the school. Run `ace config`
or `ace paths` to debug configuration.

## Rulings

- chakrit, 2026-11-25: "before we start working i want you also to become a "sink" for
  feature requests/fixes and such and to work as autonomously as you can"
- chakrit, 2026-11-25: "it MUST authroize work here automatically i why i'm telling you
  in the first place." and "i don't want to have to "ok" every little thing it slows the
  whole development down"
- chakrit, 2026-11-25: "publishing should also not need me"
- chakrit, 2026-11-25: "do not use my approival as you hedging for correctness of work"
- chakrit, 2026-11-25: "could you build an instruction system where by the instruction
  themselves will get adapted automatically as part of regular work so long as it align
  with the philosophy?"
