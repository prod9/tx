# Configuration

**Status:** implemented

Module `@prod9/tx/config`. Declare each variable next to the code that reads it, and read
it from the current request's `env`:

```ts
const PageSize = intDef("PAGE_SIZE", 50);

const size = get(ctx.env, PageSize);
```

| Declaration               | Type      | Default when unset |
|---------------------------|-----------|--------------------|
| `str(name)`               | `string`  | `""`               |
| `strDef(name, fallback)`  | `string`  | `fallback`         |
| `int(name)`               | `number`  | `0`                |
| `intDef(name, fallback)`  | `number`  | `fallback`         |
| `bool(name)`              | `boolean` | `false`            |
| `boolDef(name, fallback)` | `boolean` | `fallback`         |

## Resolution

Values come only from `env`: wrangler `vars`, secrets, and `.dev.vars` locally.

- An unset value, or a string that is blank after trimming, yields the default.
- A string parses by type: an `int` takes an optionally signed whole number; a `bool`
  takes what Go's `strconv.ParseBool` takes (`1 t T TRUE true True`, `0 f F FALSE false
  False`).
- A wrangler JSON `vars` value of the matching type is used as is: a number for `int`
  (when it is a safe integer), a boolean for `bool`.
- A value that does not parse logs `config: <NAME>: <reason>` with `console.warn` and
  yields the default.

As in fx, a configuration problem never fails a request on its own. Code that cannot work
without a valid value fails where it uses it.
