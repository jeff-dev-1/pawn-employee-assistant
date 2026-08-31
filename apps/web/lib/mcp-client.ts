import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export type ToolSummary = { name: string; description: string; inputSchema: unknown };

/** Short-lived client per call. The servers are stateless, so pooling buys nothing. */
async function connect(url: string): Promise<Client> {
  const client = new Client({ name: 'pawn-orchestrator', version: '0.1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

export async function fetchTools(url: string): Promise<ToolSummary[]> {
  const client = await connect(url);
  try {
    const { tools } = await client.listTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema,
    }));
  } finally {
    await client.close();
  }
}

export async function callTool(
  url: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const client = await connect(url);
  try {
    const response = await client.callTool({ name: tool, arguments: args });
    const text = (response.content as { text?: string }[] | undefined)?.[0]?.text;
    if (text === undefined) return { status: 'empty' };
    try {
      return JSON.parse(text);
    } catch {
      return { status: 'ok', text };
    }
  } finally {
    await client.close();
  }
}
