// Validators and the error they produce: docs/spec/actions.md, docs/spec/errors.md

export interface FieldError {
  readonly field: string;
  readonly message: string;
  readonly value: unknown;
}

export type Fields = Readonly<Record<string, readonly FieldError[]>>;

export class ValidationError extends Error {
  constructor(readonly fields: Fields) {
    const lines = Object.values(fields).flatMap((errs) =>
      errs.map((err) => `${err.field}: ${err.message}`),
    );
    super(lines.join("; "));
    this.name = "ValidationError";
  }
}

export type Check = FieldError | ValidationError | undefined;

export function all(...checks: Check[]): ValidationError | undefined {
  return merge("", checks);
}

export function group(name: string, ...checks: Check[]): ValidationError | undefined {
  return merge(`${name}.`, checks);
}

export function required(field: string, value: string): FieldError | undefined {
  return value.trim() === "" ? { field, message: "missing", value } : undefined;
}

export function minLen(field: string, value: string, length: number): FieldError | undefined {
  return value.trim().length < length
    ? { field, message: `too short, ${length} characters required`, value }
    : undefined;
}

export function positive(field: string, value: number): FieldError | undefined {
  return value <= 0 ? { field, message: "must be positive", value } : undefined;
}

export function nonNegative(field: string, value: number): FieldError | undefined {
  return value < 0 ? { field, message: "must be 0 or higher", value } : undefined;
}

// merging

function merge(prefix: string, checks: readonly Check[]): ValidationError | undefined {
  const failed = checks.flatMap(flatten).map((err) => ({ ...err, field: prefix + err.field }));
  if (failed.length === 0) return undefined;

  return new ValidationError(Object.fromEntries(Map.groupBy(failed, (err) => err.field)));
}

function flatten(check: Check): readonly FieldError[] {
  if (check === undefined) return [];
  if (check instanceof ValidationError) return Object.values(check.fields).flat();
  return [check];
}
