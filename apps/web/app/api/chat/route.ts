import { runToolLoop } from '@/lib/orchestrator/agent-loop';
import { execute } from '@/lib/orchestrator/execute';
import { plan } from '@/lib/orchestrator/plan';
import { synthesize } from '@/lib/orchestrator/synthesize';
import { currentUser } from '@/lib/orchestrator/user';

export async function POST(request: Request) {
  const { question } = (await request.json()) as { question?: string };
  if (!question) {
    return Response.json({ status: 'invalid_args', detail: 'question is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        // Appendix A: the same four event shapes, produced by the AI SDK's tool loop
        // instead of by the three hand-written stages. Compare the logged call counts.
        if (process.env.ORCHESTRATOR === 'toolloop') {
          await runToolLoop(question, currentUser(), send);
          return;
        }

        // Stage 1: plan. One LLM call.
        const planned = await plan(question, currentUser());
        send({
          type: 'plan',
          calls: planned.calls,
          reasoning: planned.reasoning,
          usage: planned.usage,
        });

        if (planned.calls.length === 0) {
          send({
            type: 'answer',
            delta: 'I cannot answer that with the information I have access to.',
          });
          // Do not close here. The finally block owns the controller; closing it twice
          // throws "Invalid state: Controller is already closed", the response fails to
          // pipe, and a clean refusal turns into a broken request.
          return;
        }

        // Stage 2: execute. No LLM calls.
        const outcomes = await execute(planned);
        for (const outcome of outcomes) {
          send({
            type: 'execute',
            server: outcome.server,
            tool: outcome.tool,
            ok: outcome.ok,
            ms: outcome.ms,
            ...(outcome.ok ? {} : { error: outcome.error }),
          });
        }

        // Stage 3: synthesize. One streaming LLM call. Consume the FULL stream, not
        // textStream: textStream drops `error` parts and an failing writer looks like silence.
        const result = synthesize(question, outcomes);
        let emitted = 0;
        for await (const part of result.stream) {
          if (part.type === 'text-delta') {
            emitted += 1;
            send({ type: 'answer', delta: part.text });
          } else if (part.type === 'error') {
            send({
              type: 'error',
              stage: 'synthesize',
              message: part.error instanceof Error ? part.error.message : String(part.error),
            });
          }
        }
        const usage = await result.totalUsage;
        // Two calls, and the UI can now show which one cost what. That is the claim of
        // DESIGN.md section 2.2 made checkable instead of asserted.
        send({
          type: 'answer',
          delta: '',
          usage: { in: usage.inputTokens ?? 0, out: usage.outputTokens ?? 0 },
        });
        console.log(`[orchestrator] 2 LLM calls for "${question}"`);
        if (emitted === 0) {
          send({ type: 'error', stage: 'synthesize', message: 'The writer model returned no text.' });
        }
      } catch (error) {
        send({
          type: 'error',
          stage: 'orchestrator',
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
