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

/** Runs the planned tool calls concurrently. */
export async function execute(plan: Plan): Promise<CallOutcome[]> {
  return Promise.all(
    plan.calls.map(async (call): Promise<CallOutcome> => {
      const started = Date.now();
      const agent = getAgent(call.server);
      const data = await callTool(agent!.url, call.tool, call.arguments);
      return { server: call.server, tool: call.tool, ok: true, ms: Date.now() - started, data };
    }),
  );
}
