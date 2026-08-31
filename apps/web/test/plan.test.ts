import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { plan } from '../lib/orchestrator/plan.js';

const CATALOG = `server "hr" - employee records
  - find_employee: Look up one employee by name or email.
    arguments: {"type":"object","properties":{"name":{"type":"string"}}}`;

/** The model is mocked on purpose: the retry path cannot be triggered on demand any other
 *  way, and a planner test that needs a live vendor is one you will skip when it matters. */
function model(texts: string[]) {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: texts[Math.min(call++, texts.length - 1)] ?? '' }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

const VALID = JSON.stringify({
  calls: [{ server: 'hr', tool: 'find_employee', arguments: { name: 'Yuki Tanaka' } }],
  reasoning: 'Employee record lookup.',
});

describe('plan', () => {
  it('returns the planned calls when the model answers in schema', async () => {
    const result = await plan('who is my manager', 'Yuki Tanaka', model([VALID]), CATALOG);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]?.tool).toBe('find_employee');
  });

  it('retries once and succeeds on the second attempt', async () => {
    const result = await plan('who is my manager', 'Yuki Tanaka', model(['not json', VALID]), CATALOG);
    expect(result.calls).toHaveLength(1);
  });

  it('refuses rather than guessing when both attempts fail', async () => {
    const result = await plan('who is my manager', 'Yuki Tanaka', model(['nope', 'still nope']), CATALOG);
    expect(result.calls).toEqual([]);
  });

  it('refuses without calling the model when no server is registered', async () => {
    const result = await plan('anything', 'Yuki Tanaka', model([VALID]), '');
    expect(result.calls).toEqual([]);
    expect(result.reasoning).toMatch(/No servers/);
  });
});
