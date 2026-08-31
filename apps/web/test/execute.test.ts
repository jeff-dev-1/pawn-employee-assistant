import { describe, expect, it } from 'vitest';
import { execute } from '../lib/orchestrator/execute.js';

/** The allSettled guarantees, stated as tests. Prompt 10 leans on all three. */
describe('execute', () => {
  it('reports an unregistered server as a failed outcome, not a throw', async () => {
    const outcomes = await execute({
      calls: [{ server: 'ghost', tool: 'anything', arguments: {} }],
      reasoning: 'test',
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.ok).toBe(false);
    expect(outcomes[0]?.error).toMatch(/not registered/);
  });

  it('keeps every outcome when one call in the batch fails', async () => {
    const outcomes = await execute({
      calls: [
        { server: 'ghost', tool: 'a', arguments: {} },
        { server: 'phantom', tool: 'b', arguments: {} },
      ],
      reasoning: 'test',
    });
    // allSettled, not all: two outcomes come back rather than one rejection.
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((outcome) => !outcome.ok)).toBe(true);
  });

  it('has nothing to do for an empty plan', async () => {
    expect(await execute({ calls: [], reasoning: 'nothing' })).toEqual([]);
  });
});
