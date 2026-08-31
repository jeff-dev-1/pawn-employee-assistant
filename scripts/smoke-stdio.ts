/**
 * The same three-step handshake over stdio - the transport Claude Desktop uses.
 *
 * It lives inside the repository on purpose: a script under /tmp has no package.json above
 * it, gets treated as CommonJS, and its top-level await fails with ERR_REQUIRE_ASYNC_MODULE.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'smoke-stdio', version: '0.1.0' });
try {
  await client.connect(
    new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'servers/hr/src/stdio.ts'],
      env: { ...process.env } as Record<string, string>,
    }),
  );
  console.log('initialize   ok  stdio');

  const { tools } = await client.listTools();
  if (tools.length === 0) throw new Error('tools/list returned nothing');
  console.log(`tools/list   ok  ${tools.map((t) => t.name).join(', ')}`);

  const response = await client.callTool({ name: 'get_team', arguments: { manager: 'Tomas Berg' } });
  const text = (response.content as { text?: string }[])[0]?.text ?? '';
  if (!text.includes('Yuki Tanaka')) throw new Error(`tools/call returned ${text}`);
  console.log('tools/call   ok');
} catch (error) {
  console.error(`FAILED  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
} finally {
  await client.close();
}
