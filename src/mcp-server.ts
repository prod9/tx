// An MCP server over a method group (docs/spec/mcp.md): every method is a tool whose
// `inputSchema` derives from its params schema. A tool call runs through the same answerer
// as the JSON-RPC API, so a tool behaves exactly like its method.

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as JsonRpc from "./json-rpc.ts";
import type { Implementation, McpMethods, Tool } from "./mcp.ts";
import { answerer, type HandlerServices, type Handlers } from "./server.ts";

// Newest first; a client asking for one of these gets it, any other gets the newest.
const protocolVersions = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;

export const mcpHandlers = <
  Group extends JsonRpc.MethodGroup<Group>,
  // biome-ignore lint/suspicious/noExplicitAny: generic constraint, as in `answerer`
  H extends Handlers<Group, any>,
>(options: {
  readonly serverInfo: Implementation;
  readonly tools: Group;
  readonly handlers: H;
}): Handlers<typeof McpMethods, HandlerServices<H>> => {
  const { serverInfo, tools } = options;
  const answerTool = answerer(tools, options.handlers);
  const toolNames: ReadonlyArray<string> = Object.keys(tools);
  const toolList = Object.entries<JsonRpc.Method<JsonRpc.ParamsCodec, JsonRpc.ResultCodec>>(
    tools,
  ).map(([name, method]) => describeTool(serverInfo, name, method));

  return {
    initialize: ({ protocolVersion }) =>
      Effect.succeed({
        protocolVersion: negotiate(protocolVersion),
        capabilities: { tools: {} },
        serverInfo,
      }),

    "notifications/initialized": () => Effect.succeed(null),

    ping: () => Effect.succeed({}),

    "tools/list": () => Effect.succeed({ tools: toolList }),

    "tools/call": ({ name, arguments: params }) =>
      Effect.gen(function* () {
        if (!toolNames.includes(name)) {
          return yield* Effect.fail({
            code: JsonRpc.ErrorCode.InvalidParams,
            message: `Unknown tool: ${name}`,
          });
        }

        const request = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: name,
          params: params ?? {},
        });
        const reply = yield* answerTool(request).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.die(new Error("a tool call with an id got no reply")),
              onSome: decodeReply,
            }),
          ),
        );

        return "error" in reply
          ? { content: [{ type: "text" as const, text: reply.error.message }], isError: true }
          : {
              content: [{ type: "text" as const, text: JSON.stringify(reply.result) }],
              isError: false,
            };
      }),
  };
};

const negotiate = (requested: string): string => {
  const supported = protocolVersions.find((version) => version === requested);
  return supported ?? protocolVersions[0];
};

const describeTool = (
  serverInfo: Implementation,
  name: string,
  method: JsonRpc.Method<JsonRpc.ParamsCodec, JsonRpc.ResultCodec>,
): Tool => {
  const document = Schema.toJsonSchemaDocument(method.params);
  const definitions =
    Object.keys(document.definitions).length === 0 ? {} : { $defs: document.definitions };

  return {
    name,
    description: `${serverInfo.name}'s ${name} method`,
    inputSchema: { ...document.schema, ...definitions },
  };
};

const decodeReply = (text: string) =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(JsonRpc.Reply))(text).pipe(Effect.orDie);
