import { listAgents } from '@/lib/registry';

// The registry lives in memory and only exists at runtime; never prerender this.
export const dynamic = 'force-dynamic';

export function GET() {
  const agents = listAgents().map((agent) => ({
    name: agent.name,
    url: agent.url,
    tools: agent.tools.length,
  }));
  return Response.json({ status: 'ok', agents });
}
