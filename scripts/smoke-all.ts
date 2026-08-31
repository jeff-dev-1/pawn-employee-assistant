/**
 * Protocol-level acceptance against every registered server. It asks the orchestrator which
 * agents exist rather than hard-coding three names - the same reason adding an agent needs
 * no change under apps/web applies here too.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const orchestrator = process.env.ORCHESTRATOR_URL ?? 'http://localhost:3000';

type Agent = { name: string; url: string };

async function walk(agent: Agent): Promise<void> {
  const client = new Client({ name: 'smoke-all', version: '0.1.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(agent.url)));
    const { tools } = await client.listTools();
    if (tools.length === 0) throw new Error('tools/list returned nothing');

    // Arguments are derived from the tool's own schema, so a new agent needs no edit here
    // either. A probe value that matches nothing is fine: what is being proven is that the
    // call completes and answers structured JSON, including a structured miss.
    for (const tool of tools) {
      const schema = tool.inputSchema as { required?: string[] } | undefined;
      const args = Object.fromEntries((schema?.required ?? []).map((key) => [key, 'smoke probe']));
      const response = await client.callTool({ name: tool.name, arguments: args });
      const text = (response.content as { text?: string }[])[0]?.text ?? '';
      JSON.parse(text);
    }

    console.log(`${agent.name.padEnd(8)} ok  ${tools.map((t) => t.name).join(', ')}`);
  } finally {
    await client.close();
  }
}

const health = (await (await fetch(`${orchestrator}/api/health`)).json()) as { agents: Agent[] };
if (health.agents.length === 0) {
  console.error('FAILED  no agents are registered');
  process.exit(1);
}

const results = await Promise.allSettled(health.agents.map(walk));
const failed = results.filter((r) => r.status === 'rejected');
for (const failure of failed) {
  console.error(`FAILED  ${String((failure as PromiseRejectedResult).reason)}`);
}
process.exit(failed.length === 0 ? 0 : 1);
