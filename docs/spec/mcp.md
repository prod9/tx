# MCP

**Status:** implemented

An app makes its methods operable by agents through the Model Context Protocol
(https://modelcontextprotocol.io/specification), over Streamable HTTP with JSON replies
only, on the same JSON-RPC server. No MCP SDK.

- `@prod9/tx/mcp`: `McpMethods` (lifecycle and tools) and their schemas. Browser-safe.
- `@prod9/tx/mcp-server`: `mcpHandlers({ serverInfo, tools, handlers })` returns the
  `Handlers` for `McpMethods` over a method group.

```ts
const answerMcp = answerer(
  McpMethods,
  mcpHandlers({ serverInfo: { name: "hangar", version: "1" }, tools: StaffMethods, handlers }),
);
```

## Behavior

- Every method of `tools` is a tool. Its `inputSchema` is the JSON Schema of the method's
  params (`Schema.toJsonSchemaDocument`), with `$defs` when it has definitions; its
  description is `<server>'s <method> method`.
- `tools/call` runs the method through `answerer`, so a tool behaves exactly like its
  method. A result answers as text content holding its JSON; a method's JSON-RPC error
  answers `isError: true` with the error's message. An unknown tool answers
  `InvalidParams`.
- `initialize` agrees on the client's protocol version when tx supports it (`2025-11-25`,
  `2025-06-18`, `2025-03-26`), otherwise the newest.
- A body of notifications answers HTTP 202: `answerHttp(request, answerMcp, 202)`.

Authentication is the app's: an endpoint checks the caller (for example a personal access
token from `bearerToken`) and provides the handlers' services before answering.
