import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { methodGroup } from "../src/json-rpc";
import type { Handlers } from "../src/server";

// A small method group shared by the tests.

export class Greeting extends Context.Service<Greeting, string>()("test/Greeting") {}

export const MathMethods = methodGroup({
  "math.add": {
    params: Schema.Struct({ a: Schema.Number, b: Schema.Number }),
    result: Schema.Number,
  },
  "math.divide": {
    params: Schema.Struct({ a: Schema.Number, b: Schema.Number }),
    result: Schema.Number,
  },
});

export const TestMethods = methodGroup({
  ...MathMethods,
  explode: { params: Schema.Struct({}), result: Schema.Null },
  greet: { params: Schema.Struct({}), result: Schema.String },
});

export const DivisionByZero = 1;

export const mathHandlers = {
  "math.add": ({ a, b }) => Effect.succeed(a + b),
  "math.divide": ({ a, b }) =>
    b === 0
      ? Effect.fail({ code: DivisionByZero, message: "division by zero" })
      : Effect.succeed(a / b),
} satisfies Handlers<typeof MathMethods, never>;

export const testHandlers = {
  ...mathHandlers,
  explode: () => Effect.die(new Error("secret internal detail")),
  greet: () => Greeting.useSync((greeting) => greeting),
} satisfies Handlers<typeof TestMethods, Greeting>;
