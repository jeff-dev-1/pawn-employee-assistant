import { isFresh, listAgents } from '@/lib/registry';

// The registry lives in memory and only exists at runtime; never prerender this.
export const dynamic = 'force-dynamic';

export function GET() {
  const agents = listAgents().map((agent) => ({
    name: agent.name,
    url: agent.url,
    tools: agent.tools.length,
    status: isFresh(agent) ? 'live' : 'stale',
    lastSeenSecondsAgo: Math.round((Date.now() - agent.registeredAt) / 1000),
  }));

  return Response.json({
    status: agents.every((a) => a.status === 'live') ? 'ok' : 'degraded',
    agents,
  });
}
