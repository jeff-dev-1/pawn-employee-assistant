import { runToolLoop } from '@/lib/orchestrator/agent-loop';
import { planner, traceUrl, writer } from '@/lib/llm';
import { execute } from '@/lib/orchestrator/execute';
import { plan } from '@/lib/orchestrator/plan';
import { synthesize } from '@/lib/orchestrator/synthesize';
import { currentUser } from '@/lib/orchestrator/user';

/** Dig the scanner's verdict out of a 446 body: hook_results -> checks -> data. */
function airsVerdict(body: unknown): unknown {
  try {
    const parsed = JSON.parse(String(body)) as {
      hook_results?: { before_request_hooks?: { checks?: { data?: Record<string, unknown> }[] }[] };
    };
    for (const hook of parsed.hook_results?.before_request_hooks ?? []) {
      for (const check of hook.checks ?? []) {
        const data = check.data;
        if (data?.action) {
          const detected = (data.prompt_detected ?? {}) as Record<string, boolean>;
          return {
            action: data.action,
            category: data.category,
            profile: data.profile_name,
            detected: Object.keys(detected).filter((k) => detected[k]),
          };
        }
      }
    }
  } catch {
    // A refusal with an unreadable body is still a refusal; the message already says so.
  }
  return undefined;
}

export async function POST(request: Request) {
  const { question, mode } = (await request.json()) as { question?: string; mode?: string };
  // One variable separates the three modes: whether the guardrail config travels with the
  // model call. Nothing else here, and nothing at all in servers/, knows the difference.
  const guarded = mode === 'protected';
  // Minted here, sent on both model calls, and reported to the UI - so every turn has a log
  // line to open, not only the ones that failed loudly enough to return a header.
  const traceId = crypto.randomUUID();
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
        const planned = await plan(question, currentUser(), planner(guarded, traceId));
        send({
          type: 'plan',
          calls: planned.calls,
          reasoning: planned.reasoning,
          usage: planned.usage,
          ms: planned.ms,
          trace: traceId,
          traceUrl: traceUrl(traceId),
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
            // What the server actually returned. The trace's job is to show the evidence
            // the answer was built from; without it the room is trusting the prose.
            ...(outcome.ok ? { data: outcome.data } : { error: outcome.error }),
          });
        }

        // Stage 3: synthesize. One streaming LLM call. Consume the FULL stream, not
        // textStream: textStream drops `error` parts and an failing writer looks like silence.
        const result = synthesize(question, outcomes, writer(guarded, traceId));
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
        // section 2.2 made checkable instead of asserted.
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
        // Say who refused. 446 is the gateway's guardrail, and the trace id is what turns
        // "it broke" into a row someone can look up.
        const api = error as {
          statusCode?: number;
          responseHeaders?: Record<string, string>;
          responseBody?: string;
        };
        const denied = api.statusCode === 446;
        const trace = api.responseHeaders?.['x-portkey-trace-id'] ?? traceId;
        send({
          type: 'error',
          stage: denied ? 'guardrail' : 'orchestrator',
          message: denied
            ? `Blocked by the gateway guardrail${trace ? ` · trace ${trace}` : ''}`
            : error instanceof Error ? error.message : String(error),
          // The scanner's own verdict rides in the refusal body. Passing it through is what
          // turns "blocked" into "blocked by this policy, for this reason".
          ...(denied ? { verdict: airsVerdict(api.responseBody) } : {}),
          trace,
          traceUrl: traceUrl(trace),
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
