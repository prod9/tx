// The Model Context Protocol methods an MCP endpoint answers: lifecycle and tools
// (docs/spec/mcp.md, https://modelcontextprotocol.io/specification). Browser-safe.

import * as Schema from "effect/Schema";
import { methodGroup } from "./json-rpc";

export const Implementation = Schema.Struct({ name: Schema.String, version: Schema.String });
export type Implementation = typeof Implementation.Type;

const Params = Schema.Record(Schema.String, Schema.Unknown);

export const Tool = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  inputSchema: Params,
});
export type Tool = typeof Tool.Type;

export const TextContent = Schema.Struct({ type: Schema.Literal("text"), text: Schema.String });

export const CallToolResult = Schema.Struct({
  content: Schema.Array(TextContent),
  isError: Schema.Boolean,
});
export type CallToolResult = typeof CallToolResult.Type;

export const McpMethods = methodGroup({
  initialize: {
    params: Schema.Struct({
      protocolVersion: Schema.String,
      capabilities: Params,
      clientInfo: Implementation,
    }),
    result: Schema.Struct({
      protocolVersion: Schema.String,
      capabilities: Schema.Struct({ tools: Schema.Struct({}) }),
      serverInfo: Implementation,
    }),
  },
  "notifications/initialized": { params: Schema.Struct({}), result: Schema.Null },
  ping: { params: Schema.Struct({}), result: Schema.Struct({}) },
  "tools/list": {
    params: Schema.Struct({ cursor: Schema.optionalKey(Schema.String) }),
    result: Schema.Struct({ tools: Schema.Array(Tool) }),
  },
  "tools/call": {
    params: Schema.Struct({ name: Schema.String, arguments: Schema.optionalKey(Params) }),
    result: CallToolResult,
  },
});
