import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { json } from 'express';

/** What every server in this repository declares about itself. */
export type ServerDefinition = {
  name: string;
  version: string;
  /** One sentence the orchestrator's planner reads when deciding whether to route here. */
  description: string;
  /** Registers this server's tools. The same function serves both transports. */
  register: (server: McpServer) => void;
};

function build(definition: ServerDefinition): McpServer {
  const server = new McpServer({ name: definition.name, version: definition.version });
  definition.register(server);
  return server;
}

/**
 * Streamable HTTP entry. Stateless: sessionIdGenerator is undefined, and a fresh server and
 * transport are built per request and closed when the response ends. Nothing is shared
 * between requests, so there is no session state to leak or to expire.
 */
export function serveHttp(definition: ServerDefinition, port: number, allowedHosts: string[] = []) {
  const app = createMcpExpressApp(
    allowedHosts.length > 0 ? { host: '0.0.0.0', allowedHosts } : {},
  );
  app.use(json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: definition.name, version: definition.version });
  });

  app.post('/mcp', async (req, res) => {
    const server = build(definition);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app.listen(port, () => {
    console.log(`[${definition.name}] listening on ${port}`);
  });
}

/** stdio entry, for hosts such as Claude Desktop. The same registration, another transport. */
export async function serveStdio(definition: ServerDefinition) {
  await build(definition).connect(new StdioServerTransport());
}
