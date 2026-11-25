// Request reading, validation and execution: docs/spec/actions.md

import type { Context } from "hono";
import type { Bindings, Ctx, TxEnv } from "./context.ts";
import { badRequest } from "./errors.ts";
import { all, type Check, type FieldError } from "./validate.ts";

export type Input = Record<string, string | number | boolean>;

export interface Action<Out, B extends Bindings = Bindings> {
  readonly input?: Input;
  validate?(): Check;
  execute(ctx: Ctx<B>): Promise<Out>;
}

export async function executeAction<Out, B extends Bindings>(
  c: Context<TxEnv<B>>,
  action: Action<Out, B>,
): Promise<Response> {
  if (action.input) readInput(action.input, await readBody(c));

  const invalid = action.validate ? all(action.validate()) : undefined;
  if (invalid) throw invalid;

  const out = await action.execute(c.var.ctx);
  return c.json(out);
}

// reading

async function readBody(c: Context): Promise<Readonly<Record<string, unknown>>> {
  const body = await parseJson(c);
  if (!isJsonObject(body)) throw badRequest("request body must be a JSON object");

  return body;
}

function isJsonObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json<unknown>();
  } catch (err) {
    if (err instanceof SyntaxError) throw badRequest("request body is not valid JSON");
    throw err;
  }
}

function readInput(input: Input, body: Readonly<Record<string, unknown>>): void {
  const keys = Object.keys(input).filter((key) => Object.hasOwn(body, key));
  const mismatched = keys
    .filter((key) => typeof body[key] !== typeof input[key])
    .map(
      (key): FieldError => ({
        field: key,
        message: `must be a ${typeof input[key]}`,
        value: body[key],
      }),
    );

  const invalid = all(...mismatched);
  if (invalid) throw invalid;

  Object.assign(input, Object.fromEntries(keys.map((key) => [key, body[key]])));
}
