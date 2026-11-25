import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { describe, expect, it } from "vitest";
import { ErrorCode } from "../src/json-rpc.ts";
import { McpMethods } from "../src/mcp.ts";
import { mcpHandlers } from "../src/mcp-server.ts";
import { answerer } from "../src/server.ts";
import { MathMethods, mathHandlers } from "./methods.ts";

// MCP over the JSON-RPC server: docs/spec/mcp.md

const answer = answerer(
  McpMethods,
  mcpHandlers({
    serverInfo: { name: "calc", version: "1" },
    tools: MathMethods,
    handlers: mathHandlers,
  }),
);

async function reply(method: string, params: unknown): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const text = await Effect.runPromise(answer(body));
  return Option.match(text, { onNone: () => undefined, onSome: (json) => JSON.parse(json) });
}

const clientInfo = { name: "test-client", version: "1" };

describe("mcpHandlers", () => {
  it("agrees on the client's protocol version when supported, else the newest", async () => {
    const supported = await reply("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo,
    });
    const unknown = await reply("initialize", {
      protocolVersion: "1999-01-01",
      capabilities: {},
      clientInfo,
    });

    expect(supported).toMatchObject({
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "calc", version: "1" },
      },
    });
    expect(unknown).toMatchObject({ result: { protocolVersion: "2025-11-25" } });
  });

  it("lists every method as a tool with its params' JSON Schema", async () => {
    const listed = (await reply("tools/list", {})) as {
      result: { tools: { name: string; inputSchema: { properties: Record<string, unknown> } }[] };
    };

    expect(listed.result.tools.map((tool) => tool.name)).toEqual(["math.add", "math.divide"]);
    expect(Object.keys(listed.result.tools[0]?.inputSchema.properties ?? {})).toEqual(["a", "b"]);
  });

  it("calls a tool through its method and returns the result as text", async () => {
    expect(
      await reply("tools/call", { name: "math.add", arguments: { a: 2, b: 2 } }),
    ).toMatchObject({
      result: { content: [{ type: "text", text: "4" }], isError: false },
    });
  });

  it("reports a method's error as a tool error", async () => {
    expect(
      await reply("tools/call", { name: "math.divide", arguments: { a: 1, b: 0 } }),
    ).toMatchObject({
      result: { content: [{ type: "text", text: "division by zero" }], isError: true },
    });
  });

  it("answers an unknown tool with Invalid params", async () => {
    expect(await reply("tools/call", { name: "math.pow", arguments: {} })).toMatchObject({
      error: { code: ErrorCode.InvalidParams },
    });
  });
});
