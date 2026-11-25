// Resolution rules: docs/spec/configuration.md

type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

export interface Var<T> {
  readonly name: string;
  readonly fallback: T;
  readonly parse: (raw: unknown) => Parsed<T>;
}

export function str(name: string): Var<string> {
  return strDef(name, "");
}

export function strDef(name: string, fallback: string): Var<string> {
  return { name, fallback, parse: parseString };
}

export function int(name: string): Var<number> {
  return intDef(name, 0);
}

export function intDef(name: string, fallback: number): Var<number> {
  return { name, fallback, parse: parseInteger };
}

export function bool(name: string): Var<boolean> {
  return boolDef(name, false);
}

export function boolDef(name: string, fallback: boolean): Var<boolean> {
  return { name, fallback, parse: parseBoolean };
}

export function get<T>(env: object, v: Var<T>): T {
  const raw: unknown = Reflect.get(env, v.name);
  if (raw === undefined || (typeof raw === "string" && raw.trim() === "")) return v.fallback;

  const parsed = v.parse(raw);
  if (parsed.ok) return parsed.value;

  console.warn(`config: ${v.name}: ${parsed.reason}`);
  return v.fallback;
}

// parsers

const INTEGER = /^[+-]?\d+$/;
const TRUE_WORDS = new Set(["1", "t", "T", "TRUE", "true", "True"]);
const FALSE_WORDS = new Set(["0", "f", "F", "FALSE", "false", "False"]);

function parseString(raw: unknown): Parsed<string> {
  if (typeof raw === "string") return { ok: true, value: raw };
  return { ok: false, reason: `not a string: ${typeof raw}` };
}

function parseInteger(raw: unknown): Parsed<number> {
  const value = typeof raw === "string" && INTEGER.test(raw.trim()) ? Number(raw) : raw;
  if (typeof value === "number" && Number.isSafeInteger(value)) return { ok: true, value };
  return { ok: false, reason: `not an integer: ${String(raw)}` };
}

function parseBoolean(raw: unknown): Parsed<boolean> {
  if (typeof raw === "boolean") return { ok: true, value: raw };

  const word = typeof raw === "string" ? raw.trim() : "";
  if (TRUE_WORDS.has(word)) return { ok: true, value: true };
  if (FALSE_WORDS.has(word)) return { ok: true, value: false };
  return { ok: false, reason: `not a boolean: ${String(raw)}` };
}
