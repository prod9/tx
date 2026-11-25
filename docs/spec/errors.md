# Errors

**Status:** implemented

Module `@prod9/tx/errors`. `createApp()` installs `renderError` as the app's error
handler, so routes and actions throw and never render errors themselves.

## Shape

Every error renders as JSON in fx's shape:

```json
{ "code": "validation", "message": "title: missing", "data": { "title": [ ... ] } }
```

`data` appears only for validation errors, holding the failed checks keyed by field.

## Rendering

| Thrown               | Status       | Body                                                      |
|----------------------|--------------|-----------------------------------------------------------|
| `ValidationError`    | 400          | `code: "validation"`, the fields' messages, `data` fields |
| `HttpError`          | its `status` | its `code` and `message`                                  |
| Hono `HTTPException` | its own      | Hono's own response for it                                |
| anything else        | 500          | `code: "internal"`, `message: "internal server error"`    |

An unexpected error's message can hold internal detail, and a Worker's response is
public, so it is logged with `console.error` (visible in `wrangler tail` and Workers Logs)
instead of rendered.

## Constructors

| Function                               | Status | Code           |
|----------------------------------------|--------|----------------|
| `notFound()`                           | 404    | `not_found`    |
| `unauthorized()`                       | 401    | `unauthorized` |
| `badRequest(message)`                  | 400    | `bad_request`  |
| `new HttpError(status, code, message)` | any    | any            |
