import { registerAgent } from '@/lib/registry';

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; url?: string; description?: string };
  if (!body.name || !body.url) {
    return Response.json(
      { status: 'invalid_args', detail: 'name and url are required' },
      { status: 400 },
    );
  }
  try {
    const agent = await registerAgent({
      name: body.name,
      url: body.url,
      description: body.description ?? '',
    });
    console.log(`[registry] ${agent.name} registered with ${agent.tools.length} tools`);
    return Response.json({ status: 'ok', name: agent.name, tools: agent.tools.map((t) => t.name) });
  } catch (error) {
    return Response.json(
      { status: 'unreachable', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
