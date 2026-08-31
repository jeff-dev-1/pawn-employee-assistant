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

/**
 * Announce this server to the orchestrator, then keep announcing. Registration is a
 * heartbeat, not a one-off: the orchestrator has to be able to tell a live server from one
 * that stopped, and it can only do that if silence means something.
 */
export function announce(
  definition: ServerDefinition,
  orchestratorUrl: string,
  advertiseUrl: string,
  everyMs = Number(process.env.REGISTER_HEARTBEAT_MS ?? 15_000),
) {
  const beat = async () => {
    try {
      const response = await fetch(`${orchestratorUrl}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: definition.name,
          url: advertiseUrl,
          description: definition.description,
        }),
      });
      // Check the response, not merely that fetch resolved. A server that logs "registered"
      // after an HTTP 500 has told you a comforting lie.
      if (!response.ok) {
        console.warn(`[${definition.name}] register returned ${response.status}`);
      }
    } catch {
      // The orchestrator may simply not be up yet. The next beat will try again.
    }
  };
  void beat();
  const timer = setInterval(beat, everyMs);
  timer.unref();
  return timer;
}

/** stdio entry, for hosts such as Claude Desktop. The same registration, another transport. */
export async function serveStdio(definition: ServerDefinition) {
  await build(definition).connect(new StdioServerTransport());
}
