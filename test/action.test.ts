import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { type Action, executeAction } from "../src/action.ts";
import { createApp, fragment } from "../src/app.ts";
import type { Ctx } from "../src/context.ts";
import { notFound } from "../src/errors.ts";
import { all, minLen, required } from "../src/validate.ts";

// Request reading, validation and error rendering: docs/spec/actions.md, docs/spec/errors.md

const todos = sqliteTable("todos", {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  done: integer({ mode: "boolean" }).notNull().default(false),
});

type Todo = typeof todos.$inferSelect;

class CreateTodo implements Action<Todo> {
  readonly input = { title: "", done: false };

  validate() {
    return all(required("title", this.input.title), minLen("title", this.input.title, 3));
  }

  async execute(ctx: Ctx): Promise<Todo> {
    return ctx.db.insert(todos).values(this.input).returning().get();
  }
}

class RenameTodo implements Action<Todo> {
  readonly input = { title: "" };

  constructor(readonly id: number) {}

  async execute(ctx: Ctx): Promise<Todo> {
    const row = await ctx.db
      .update(todos)
      .set({ title: this.input.title })
      .where(eq(todos.id, this.id))
      .returning()
      .get();
    if (!row) throw notFound();

    return row;
  }
}

class Explode implements Action<Todo> {
  async execute(): Promise<Todo> {
    throw new Error("secret internal detail");
  }
}

const todoRoutes = fragment()
  .post("/", (c) => executeAction(c, new CreateTodo()))
  .post("/explode", (c) => executeAction(c, new Explode()))
  .post("/:id", (c) => executeAction(c, new RenameTodo(Number(c.req.param("id")))));

const app = createApp().route("/todos", todoRoutes);

function post(path: string, body: string) {
  return app.request(
    path,
    { method: "POST", body, headers: { "Content-Type": "application/json" } },
    env,
  );
}

describe("executeAction", () => {
  it("reads, validates, executes, and renders the result", async () => {
    const res = await post("/todos", JSON.stringify({ title: "buy milk", done: true }));

    expect(res.status).toBe(200);
    const todo = await res.json<Todo>();
    expect(todo).toMatchObject({ title: "buy milk", done: true });

    const stored = await env.DB.prepare("SELECT title, done FROM todos WHERE id = ?")
      .bind(todo.id)
      .first();
    expect(stored).toEqual({ title: "buy milk", done: 1 });
  });

  it("renders validation failures as 400 with fields", async () => {
    const res = await post("/todos", JSON.stringify({ title: "ab" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "validation",
      message: "title: too short, 3 characters required",
      data: {
        title: [{ field: "title", message: "too short, 3 characters required", value: "ab" }],
      },
    });
  });

  it("rejects a value whose type differs from the input field", async () => {
    const res = await post("/todos", JSON.stringify({ title: 42, done: "yes" }));

    expect(res.status).toBe(400);
    const body = await res.json<{ code: string; data: Record<string, unknown> }>();
    expect(body.code).toBe("validation");
    expect(Object.keys(body.data).sort()).toEqual(["done", "title"]);
  });

  it("reads only declared input fields, so the body cannot set route values", async () => {
    const created = await (await post("/todos", JSON.stringify({ title: "first" }))).json<Todo>();
    const other = await (await post("/todos", JSON.stringify({ title: "second" }))).json<Todo>();

    const res = await post(
      `/todos/${created.id}`,
      JSON.stringify({ id: other.id, title: "renamed", extra: true }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: created.id, title: "renamed" });
    const untouched = await env.DB.prepare("SELECT title FROM todos WHERE id = ?")
      .bind(other.id)
      .first();
    expect(untouched).toEqual({ title: "second" });
  });

  it("renders malformed JSON and non-object bodies as 400 bad_request", async () => {
    const malformed = await post("/todos", "{not json");
    const array = await post("/todos", "[1, 2]");

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: "bad_request" });
    expect(array.status).toBe(400);
    expect(await array.json()).toMatchObject({ code: "bad_request" });
  });

  it("renders an HttpError with its status and code", async () => {
    const res = await post("/todos/999999", JSON.stringify({ title: "nobody" }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not_found", message: "not found" });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const res = await post("/todos/explode", "{}");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: "internal", message: "internal server error" });
  });
});
