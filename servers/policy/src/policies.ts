import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Policy = { title: string; file: string; text: string };
export type Excerpt = { title: string; file: string; excerpt: string; score: number };

export function loadPolicies(dir: string): Policy[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const text = readFileSync(join(dir, file), 'utf8');
      const heading = /^#\s+(.+)$/m.exec(text)?.[1];
      return { title: heading ?? file.replace(/\.md$/, ''), file, text };
    });
}

const words = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

/**
 * Keyword search over a dozen documents. No vector store: the corpus fits in the context
 * window, and an embedding index would be more machinery than the problem deserves.
 */
export function searchPolicy(policies: Policy[], query: string, limit = 3): { matches: Excerpt[] } {
  const terms = words(query);
  if (terms.length === 0) return { matches: [] };

  const matches: Excerpt[] = [];
  for (const policy of policies) {
    // The title bonus ranks the document. It must not rank paragraphs against each other,
    // or the "# Remote Work" heading outscores the paragraph that answers the question.
    const titleBonus = terms.filter((term) => policy.title.toLowerCase().includes(term)).length;

    let best: { text: string; score: number } | undefined;
    for (const paragraph of policy.text.split(/\n\s*\n/)) {
      const text = paragraph.trim();
      if (text === '' || text.startsWith('#')) continue;
      const haystack = text.toLowerCase();
      const score = terms.filter((term) => haystack.includes(term)).length;
      if (score > 0 && (best === undefined || score > best.score)) best = { text, score };
    }

    // A title match with no matching paragraph still earns the document's opening passage:
    // "what is the remote work policy" names the document rather than any word inside it.
    if (best === undefined && titleBonus > 0) {
      const opening = policy.text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .find((p) => p !== '' && !p.startsWith('#'));
      if (opening) best = { text: opening, score: 0 };
    }

    if (best) {
      matches.push({
        title: policy.title,
        file: policy.file,
        excerpt: best.text,
        score: best.score + titleBonus,
      });
    }
  }
  return { matches: matches.sort((a, b) => b.score - a.score).slice(0, limit) };
}
