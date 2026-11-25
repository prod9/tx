# Patterns

**Status:** accepted

The recommended way to write an app's code on tx. These are conventions over Effect and
`@effect/sql-d1`; tx adds no code for them.

## Database

D1 through `@effect/sql-d1`, by chakrit's ruling on 2026-11-25 ("all your recommendation
is sound", accepting it over Drizzle and hand-written D1 helpers). Provide it with
`D1Client.layer({ db: env.DB })`; the binding is named `DB`.

- Write SQL with the `SqlClient` tagged template: values interpolate as bound parameters.
- Decode rows through their `Schema` where they are read. A row that fails its schema is
  a defect: the app wrote it.
- Writes that must succeed together go in one `D1Client.batch([...])`, which D1 runs
  atomically. Guard a state transition with a `UNIQUE` constraint, so a lost race fails
  the whole batch.
- A failed query is an `SqlError`. A handler maps the ones its caller can act on to a
  JSON-RPC error and lets the rest die.

## Actions

An action is one write: a class whose fields are its inputs, set by the constructor,
with one `run()` method returning an `Effect`.

```ts
export class CreateProject {
  constructor(readonly actor: Actor, readonly project: ProjectSummary, readonly now: DateTime.Utc) {}

  run(): Effect.Effect<void, SqlError, SqlClient.SqlClient> { ... }
}
```

A handler decodes nothing itself (the method's params schema did), reads what it needs,
and runs actions. Values from the caller's session are constructor arguments, never
params.

## Config

Declare each `Config` next to the code that reads it (`Config.String("ORIGIN")`), and
`yield*` it inside an Effect. There is no central config object.
