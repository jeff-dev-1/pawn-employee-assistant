import { generateText, Output } from 'ai';
import { z } from 'zod';
import { planner } from '../llm';
import { toolCatalog } from '../registry';

export const PlanSchema = z.object({
  calls: z
    .array(
      z.object({
        server: z.string().describe('Server name exactly as it appears in the catalog'),
        tool: z.string().describe('Tool name exactly as it appears in the catalog'),
        // "arguments", not "args": that is the word MCP's own tools/call uses, and the word
        // the model reaches for unprompted. A schema that fights the domain's vocabulary
        // loses on every retry.
        arguments: z
          .record(z.string(), z.unknown())
          .describe('Arguments matching the tool schema. Rarely empty.'),
      }),
    )
    .describe('Empty when no server in the catalog can answer the question'),
  // Optional: a missing rationale is not a reason to discard an otherwise valid plan.
  reasoning: z.string().default('').describe('One sentence explaining the selection'),
});

/** What the plan cost, so the UI can put a number next to stage 1. */
export type Usage = { in: number; out: number };

export type Plan = z.infer<typeof PlanSchema> & { usage?: Usage };

const EMPTY: Plan = { calls: [], reasoning: 'The planner could not produce a valid plan.' };

function prompt(question: string, catalog: string, user: string): string {
  return `You route employee questions to the tools that can answer them.

AVAILABLE SERVERS AND TOOLS
${catalog}

THE PERSON ASKING
${user}. Resolve "I", "me" and "my" to this name when filling arguments.

QUESTION
"${question}"

RULES
- Select every tool needed. A question spanning two domains produces two or more calls.
- Use server and tool names exactly as written above. Invent nothing.
- Fill in the arguments. Empty arguments are almost always a mistake.
- Always answer with the full plan object. Every call goes inside the "calls" array, even
  when there is only one. A bare call object is not a plan.

EXAMPLE
For "how much leave do I have left", the entire reply is:
{"calls":[{"server":"hr","tool":"find_employee","arguments":{"name":"${user}"}}],"reasoning":"Leave balance is on the employee record."}
- If no tool above can answer, return an empty calls array. Never guess a default server.
- You get one shot. You cannot use the result of one tool as the argument to another.`;
}

/**
 * One LLM call. Schema-constrained, one retry, then an explicit refusal. Empty calls means
 * "I cannot answer this" - it never falls back to a default server, because that turns a
 * routing error into a silently wrong answer.
 */
export async function plan(
  question: string,
  user: string,
  model = planner(),
  catalog = toolCatalog(),
): Promise<Plan> {
  if (catalog === '') return { calls: [], reasoning: 'No servers are registered.' };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { output, usage } = await generateText({
        model,
        output: Output.object({ schema: PlanSchema }),
        prompt: prompt(question, catalog, user),
      });
      console.log(`[plan] attempt ${attempt}: ${JSON.stringify(output)}`);
      return { ...output, usage: { in: usage.inputTokens ?? 0, out: usage.outputTokens ?? 0 } };
    } catch (error) {
      // A gateway guardrail refusing the call is not a planning failure. Retrying burns a
      // round trip, and reporting it as "I cannot answer that" sends the reader hunting for
      // a missing tool instead of a security control. Let it out.
      if ((error as { statusCode?: number }).statusCode === 446) throw error;
      const message = error instanceof Error ? error.message : String(error);
      // Log the raw model text. Without it you are guessing at what went wrong.
      const raw = (error as { text?: string })?.text;
      console.log(`[plan] attempt ${attempt} failed: ${message}`);
      if (raw) console.log(`[plan] model returned: ${String(raw).slice(0, 400)}`);
    }
  }
  return EMPTY;
}
