/**
 * Protocol-level acceptance over Streamable HTTP. It uses the official SDK client and walks
 * initialize -> tools/list -> tools/call. It never imports the server's internals: the point
 * is to prove the transport works, not that a function runs.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2] ?? `http://localhost:${process.env.HR_PORT ?? 3101}/mcp`;

const client = new Client({ name: 'smoke', version: '0.1.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  console.log(`initialize   ok  ${url}`);

  const { tools } = await client.listTools();
  if (tools.length === 0) throw new Error('tools/list returned nothing');
  console.log(`tools/list   ok  ${tools.map((t) => t.name).join(', ')}`);

  const response = await client.callTool({
    name: 'find_employee',
    arguments: { name: 'Dana Reeve' },
  });
  const text = (response.content as { text?: string }[])[0]?.text ?? '';
  if (!text.includes('Dana Reeve')) throw new Error(`tools/call returned ${text}`);
  console.log('tools/call   ok');
} catch (error) {
  console.error(`FAILED  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
} finally {
  await client.close();
}
