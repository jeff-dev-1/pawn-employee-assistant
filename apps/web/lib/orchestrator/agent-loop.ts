import { dynamicTool, jsonSchema, stepCountIs, ToolLoopAgent, type ToolSet } from 'ai';
import { planner } from '../llm';
import { callTool } from '../mcp-client';
import { listAgents } from '../registry';
import type { CallOutcome } from './execute';

/**
 * Appendix A. The same job as plan + execute + synthesize, handed to the AI SDK's
 * ToolLoopAgent instead of hand-written. Selected by ORCHESTRATOR=toolloop, so both
 * versions ship and the LLM call counts can be compared against each other.
 *
 * What the loop buys: it re-plans after every tool result, so it can feed one tool's
 * output into the next tool's arguments - the single-shot planner's stated limit.
 * What it costs: one LLM call per step instead of a flat two per question.
 *
 * It emits the same four SSE event shapes, so app/page.tsx does not change. The four
 * shapes are the interface between orchestrator and UI; both orchestrators satisfy it.
 */

/** MCP names the pair (server, tool); a model tool name is flat. */
const SEPARATOR = '__';
const MAX_STEPS = Number(process.env.AGENT_MAX_STEPS ?? 6);

export async function runToolLoop(
  question: string,
  user: string,
  send: (event: unknown) => void,
): Promise<number> {
  const outcomes = new Map<string, CallOutcome>();
  const tools: ToolSet = {};

  // Built from the same registry the planner reads: a fourth agent needs no change here
  // either. Tool descriptions carry the domain knowledge, exactly as in Prompt 6.
  for (const agent of listAgents()) {
    for (const summary of agent.tools) {
      tools[`${agent.name}${SEPARATOR}${summary.name}`] = dynamicTool({
        description: `[${agent.name}] ${summary.description}`,
        inputSchema: jsonSchema(summary.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: async (args, { toolCallId }) => {
          const started = Date.now();
          try {
            const data = await callTool(agent.url, summary.name, args as Record<string, unknown>);
            outcomes.set(toolCallId, {
              server: agent.name,
              tool: summary.name,
              ok: true,
              ms: Date.now() - started,
            });
            return data;
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            outcomes.set(toolCallId, {
              server: agent.name,
              tool: summary.name,
              ok: false,
              ms: Date.now() - started,
              error: detail,
            });
            // Returned, not thrown. A dead server has to degrade the answer, not end the
            // loop - the Prompt 10 rule, restated in the framework's own vocabulary.
            return { status: 'unavailable', detail };
          }
        },
      });
    }
  }

  const loop = new ToolLoopAgent({
    model: planner(),
    instructions: `You answer employee questions using the tools available to you.
The person asking is ${user}. Resolve "I", "me" and "my" to that name.
Call the tools you need. You may call one, read its result, and use that result to decide
the next call. Use only what the tools return; add nothing you happen to know.
If a tool reports itself unavailable, say which part of the question you could not answer.
Answer in English, in at most four sentences.`,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
  });

  const result = await loop.stream({ prompt: question });

  let steps = 0;
  for await (const part of result.stream) {
    if (part.type === 'start-step') {
      steps += 1;
    } else if (part.type === 'tool-call') {
      const [server, tool] = part.toolName.split(SEPARATOR);
      send({
        type: 'plan',
        calls: [{ server, tool, arguments: part.input }],
        reasoning: `tool loop step ${steps}`,
      });
    } else if (part.type === 'tool-result' || part.type === 'tool-error') {
      const outcome = outcomes.get(part.toolCallId);
      if (outcome) send({ type: 'execute', ...outcome });
    } else if (part.type === 'text-delta') {
      send({ type: 'answer', delta: part.text });
    } else if (part.type === 'error') {
      const message = part.error instanceof Error ? part.error.message : String(part.error);
      send({ type: 'error', stage: 'agent-loop', message });
    }
  }

  // The numbers the appendix exists to show. The call count is only half of it: every step
  // re-sends the whole tool catalog and every result so far, so input tokens grow with the
  // loop even when the call count does not.
  const usage = await result.totalUsage;
  console.log(`[cost] agent-loop ${usage.inputTokens ?? 0} in / ${usage.outputTokens ?? 0} out`);
  console.log(`[agent-loop] ${steps} LLM calls for "${question}"`);
  return steps;
}
