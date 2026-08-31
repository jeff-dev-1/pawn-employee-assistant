import { callTool } from '../mcp-client';
import { getAgent } from '../registry';
import type { Plan } from './plan';

export type CallOutcome = {
  server: string;
  tool: string;
  ok: boolean;
  ms: number;
  data?: unknown;
  error?: string;
};

/**
 * Zero LLM calls. allSettled, never all: in a multi-agent system partial failure is the
 * normal case, and one unreachable server must not take down the whole answer.
 */
export async function execute(plan: Plan): Promise<CallOutcome[]> {
  const settled = await Promise.allSettled(
    plan.calls.map(async (call): Promise<CallOutcome> => {
      const started = Date.now();
      const agent = getAgent(call.server);
      if (!agent) {
        return {
          server: call.server,
          tool: call.tool,
          ok: false,
          ms: 0,
          error: `Server "${call.server}" is not registered.`,
        };
      }
      try {
        const data = await callTool(agent.url, call.tool, call.arguments);
        return { server: call.server, tool: call.tool, ok: true, ms: Date.now() - started, data };
      } catch (error) {
        return {
          server: call.server,
          tool: call.tool,
          ok: false,
          ms: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  return settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') return outcome.value;
    const call = plan.calls[index];
    return {
      server: call?.server ?? 'unknown',
      tool: call?.tool ?? 'unknown',
      ok: false,
      ms: 0,
      error: String(outcome.reason),
    };
  });
}
