import { execute } from '@/lib/orchestrator/execute';
import { plan } from '@/lib/orchestrator/plan';
import { synthesize } from '@/lib/orchestrator/synthesize';
import { currentUser } from '@/lib/orchestrator/user';

export async function POST(request: Request) {
  const { question } = (await request.json()) as { question?: string };
  if (!question) {
    return Response.json({ status: 'invalid_args', detail: 'question is required' }, { status: 400 });
  }

  const planned = await plan(question, currentUser());
  if (planned.calls.length === 0) {
    return Response.json({
      plan: planned,
      answer: 'I cannot answer that with the information I have access to.',
    });
  }

  const outcomes = await execute(planned);

  // Consume the FULL stream, not textStream: textStream silently drops `error` parts, so a
  // writer that fails mid-stream produces an empty answer and no explanation - worse than
  // an error, because nothing looks broken.
  const result = synthesize(question, outcomes);
  let answer = '';
  let failure: string | undefined;
  for await (const part of result.stream) {
    if (part.type === 'text-delta') answer += part.text;
    else if (part.type === 'error') {
      failure = part.error instanceof Error ? part.error.message : String(part.error);
    }
  }
  if (answer === '' && failure === undefined) failure = 'The writer model returned no text.';

  return Response.json({
    plan: planned,
    outcomes: outcomes.map(({ data: _data, ...rest }) => rest),
    answer,
    ...(failure ? { error: failure } : {}),
  });
}
