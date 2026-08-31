import { describe, expect, it } from 'vitest';
import { loadPolicies, searchPolicy } from '../src/policies.js';

const dir = new URL('./fixture', import.meta.url).pathname;
const policies = loadPolicies(dir);

describe('search_policy', () => {
  it('loads a title from the markdown heading', () => {
    expect(policies.map((p) => p.title).sort()).toEqual(['Alpha Policy', 'Beta Policy']);
  });

  it('returns the matching passage with its title', () => {
    const { matches } = searchPolicy(policies, 'remote work days');
    expect(matches[0]).toMatchObject({ title: 'Alpha Policy' });
    expect(matches[0]?.excerpt).toContain('three days per week');
  });

  it('ranks the better match first', () => {
    const { matches } = searchPolicy(policies, 'expenses submitted');
    expect(matches[0]?.title).toBe('Beta Policy');
  });

  it('returns an empty list rather than an error when nothing matches', () => {
    expect(searchPolicy(policies, 'zzzz').matches).toEqual([]);
  });

  it('returns an empty list for a query with no usable words', () => {
    expect(searchPolicy(policies, 'a i').matches).toEqual([]);
  });
});
