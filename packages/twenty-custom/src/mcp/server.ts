import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ToolSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import { TwentyGraphQLClient } from '../shared/graphql-client';
import { registerLandingTools } from './tools/landing';
import { registerCrmTools } from './tools/crm';
import { registerInventoryTools } from './tools/inventory';
import { registerPaymentTools } from './tools/payment';
import { registerBridgeTools } from './tools/bridge';
import { registerEmailTools } from './tools/email';
import { registerWorkflowTools } from './tools/workflow';
import type { Request, Response } from 'express';

type Tool = z.infer<typeof ToolSchema>;

export function buildMcpServer(client: TwentyGraphQLClient): Server {
  const server = new Server(
    { name: 'vinpeti-crm', version: '1.0.0' },
    { capabilities: { tools: { listChanged: true } } }
  );

  const tools: Tool[] = [];
  const toolHandlers = new Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>>();

  server.setRequestHandler(InitializeRequestSchema, () => ({
    protocolVersion: '2025-06-18',
    capabilities: { tools: { listChanged: true } },
    serverInfo: { name: 'vinpeti-crm', version: '1.0.0' },
  }));

  registerLandingTools(server, tools, toolHandlers);
  registerCrmTools(server, client, tools, toolHandlers);
  registerInventoryTools(server, client, tools, toolHandlers);
  registerPaymentTools(server, client, tools, toolHandlers);
  registerBridgeTools(server, client, tools, toolHandlers);
  registerEmailTools(server, tools, toolHandlers);
  registerWorkflowTools(server, client, tools, toolHandlers);

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers.get(name);
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }
    return handler(args || {});
  });

  return server;
}

// ponytail: stateless transport. Server is shared across requests — tools list/registry built once at startup.
// If profiling shows connection overhead, consider pooling McpServer instances per session.
export function mcpHttpHandler(client: TwentyGraphQLClient) {
  const server = buildMcpServer(client);
  return async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    await server.connect(transport);
    let parsedBody: unknown;
    try {
      parsedBody = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    } catch {
      parsedBody = req.body;
    }
    await transport.handleRequest(req, res, parsedBody);
  };
}
