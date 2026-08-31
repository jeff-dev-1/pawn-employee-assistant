import { beforeAll, describe, expect, it } from 'vitest';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { execute } from '../lib/orchestrator/execute';
import { plan } from '../lib/orchestrator/plan';
import { synthesize } from '../lib/orchestrator/synthesize';
import { registerAgent, toolCatalog } from '../lib/registry';

const HR = process.env.HR_URL ?? 'http://localhost:3101/mcp';
const IT = process.env.IT_URL ?? 'http://localhost:3102/mcp';

async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url.replace('/mcp', '/health'), { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

const live = (await reachable(HR)) && (await reachable(IT));

function planner(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

function writer(chunks: string[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start' as const, id: '1' },
          ...chunks.map((text) => ({ type: 'text-delta' as const, id: '1', delta: text })),
          { type: 'text-end' as const, id: '1' },
          {
            type: 'finish' as const,
            finishReason: { unified: 'stop' as const, raw: undefined },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
}

/**
 * Models mocked, MCP servers real. That combination proves the cross-domain path - plan,
 * concurrent execution over two live servers, synthesis - without a key and without the
 * network. Skipped rather than failed when the servers are not running.
 */
describe.skipIf(!live)('orchestrator pipeline against live MCP servers', () => {
  beforeAll(async () => {
    await registerAgent({ name: 'hr', url: HR, description: 'Employee records.' });
    await registerAgent({ name: 'it', url: IT, description: 'IT support tickets.' });
  });

  it('builds the catalog from what the servers actually expose', () => {
    const catalog = toolCatalog();
    expect(catalog).toContain('find_employee');
    expect(catalog).toContain('list_tickets');
  });

  it('fetches from both domains and composes one answer', async () => {
    const planned = await plan(
      'who is my manager and what tickets have I opened',
      'Yuki Tanaka',
      planner(
        JSON.stringify({
          calls: [
            { server: 'hr', tool: 'find_employee', arguments: { name: 'Yuki Tanaka' } },
            { server: 'it', tool: 'list_tickets', arguments: { requester: 'Yuki Tanaka' } },
          ],
          reasoning: 'Two domains.',
        }),
      ),
    );
    expect(planned.calls).toHaveLength(2);

    const outcomes = await execute(planned);
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect(JSON.stringify(outcomes)).toContain('Tomas Berg');

    const result = synthesize('who is my manager', outcomes, writer(['Your manager is ', 'Tomas Berg.']));
    let answer = '';
    for await (const part of result.stream) if (part.type === 'text-delta') answer += part.text;
    expect(answer).toBe('Your manager is Tomas Berg.');
  });

  it('degrades instead of throwing when one server is unreachable', async () => {
    const outcomes = await execute({
      calls: [
        { server: 'hr', tool: 'find_employee', arguments: { name: 'Yuki Tanaka' } },
        { server: 'ghost', tool: 'list_tickets', arguments: {} },
      ],
      reasoning: 'one live, one dead',
    });
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok)).toHaveLength(1);
  });
});
