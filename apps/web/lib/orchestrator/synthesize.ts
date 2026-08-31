import { streamText } from 'ai';
import { writer } from '../llm';
import type { CallOutcome } from './execute';

function brief(question: string, outcomes: CallOutcome[]): string {
  const succeeded = outcomes.filter((o) => o.ok);
  const failed = outcomes.filter((o) => !o.ok);

  const retrieved =
    succeeded.length === 0
      ? '(nothing was retrieved)'
      : succeeded
          .map((o) => `${o.server}.${o.tool} returned:\n${JSON.stringify(o.data)}`)
          .join('\n\n');

  const missing =
    failed.length === 0
      ? ''
      : `\n\nUNAVAILABLE\n${failed.map((o) => `${o.server}.${o.tool}: ${o.error}`).join('\n')}`;

  return `An employee asked: "${question}"

RETRIEVED DATA
${retrieved}${missing}

Write the answer in English, in at most four sentences.
Use only the retrieved data. Add nothing you happen to know.
If something was unavailable, say plainly which part of the question you could not answer.
If nothing was retrieved, say you cannot answer and do not speculate.`;
}

/** One streaming LLM call. Returns the token stream so the route can forward it. */
export function synthesize(question: string, outcomes: CallOutcome[], model = writer()) {
  return streamText({ model, prompt: brief(question, outcomes) });
}
