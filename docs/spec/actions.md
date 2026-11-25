# Actions

**Status:** implemented

Modules `@prod9/tx/action` and `@prod9/tx/validate`.

An action is one unit of work behind a route: an object with optional `input`, optional
`validate()`, and `execute(ctx)`. A route runs it with `executeAction(c, action)`:

```ts
class RenameTodo implements Action<Todo> {
  readonly input = { title: "" };

  constructor(readonly id: number) {}

  validate() {
    return all(required("title", this.input.title), minLen("title", this.input.title, 3));
  }

  async execute(ctx: Ctx): Promise<Todo> {
    const row = await ctx.db.update(todos).set(this.input)
      .where(eq(todos.id, this.id)).returning().get();
    if (!row) throw notFound();
    return row;
  }
}

fragment().post("/:id", (c) => executeAction(c, new RenameTodo(Number(c.req.param("id")))));
```

## executeAction

1. **Read.** When the action has `input`, the JSON request body is read into it. A body
   that is not valid JSON, or not a JSON object, renders `400 bad_request`.
2. **Allowlist.** Only keys `input` declares are read; other body keys are ignored. Each
   key's default value fixes its type (`string`, `number` or `boolean`); a body value of
   another type is a field error `must be a <type>`, and all of them render together as
   a `400 validation` error before `validate()` runs.
3. **Validate.** `validate()`, when present, returns a `Check`; a failure renders
   `400 validation`.
4. **Execute.** `execute(ctx)` receives the request's `Ctx`. Its result renders as JSON
   with status 200; a thrown error renders by `errors.md`.

Values the route supplies, such as path parameters or the signed-in user, are constructor
arguments and live outside `input`, so a request body can never set them.

## Validators

Each validator returns a `FieldError` or `undefined`, and `all` and `group` combine them
into a `ValidationError` or `undefined`.

| Function                 | Fails with                                                       |
|--------------------------|------------------------------------------------------------------|
| `required(field, s)`     | `missing` when `s` is blank after trimming                       |
| `minLen(field, s, n)`    | `too short, <n> characters required`, counting trimmed `s`       |
| `positive(field, n)`     | `must be positive` when `n <= 0`                                 |
| `nonNegative(field, n)`  | `must be 0 or higher` when `n < 0`                               |
| `all(...checks)`         | every failed check, merged by field                              |
| `group(name, ...checks)` | as `all`, with fields prefixed `<name>.`                         |
