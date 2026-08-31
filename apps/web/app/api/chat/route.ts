import { callTool } from '@/lib/mcp-client';
import { plan } from '@/lib/orchestrator/plan';
import { currentUser } from '@/lib/orchestrator/user';
import { getAgent } from '@/lib/registry';

/** Prompt 6: show the raw shape. Synthesis comes in Prompt 7. */
export async function POST(request: Request) {
  const { question } = (await request.json()) as { question?: string };
  if (!question) {
    return Response.json({ status: 'invalid_args', detail: 'question is required' }, { status: 400 });
  }

  const planned = await plan(question, currentUser());
  const results = [];
  for (const call of planned.calls) {
    const agent = getAgent(call.server);
    if (!agent) {
      results.push({ ...call, error: `Server "${call.server}" is not registered.` });
      continue;
    }
    results.push({ ...call, data: await callTool(agent.url, call.tool, call.arguments) });
  }

  return Response.json({ plan: planned, results });
}
