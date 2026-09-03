import { streamText } from 'ai';
import { writer } from '../llm';
import type { CallOutcome } from './execute';

/**
 * The language the answer is written in. The records are English either way - a translated
 * answer is a translation of an English record, and saying so is the honest version - but
 * that is a reason to name the source language, not a reason to answer in a language the
 * reader did not ask for.
 */
const LANGUAGE: Record<string, string> = {
  en: 'English',
  'zh-Hant': 'Traditional Chinese (繁體中文)',
};

function brief(question: string, outcomes: CallOutcome[], lang: string): string {
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

Write the answer in ${LANGUAGE[lang] ?? 'English'}, as markdown. The retrieved data is in
English; translate your prose, never the identifiers inside it - names, ticket ids, email
addresses and tool names stay exactly as the records spell them.
Use only the retrieved data. Add nothing you happen to know.
Lead with the answer itself in one sentence.
When the retrieved data holds two or more values a reader would compare - a leave total
and what is left of it, a list of tickets, the members of a team - follow that sentence
with a markdown table built from those values. Give every row a label and a value; a
table of one row is just a sentence, so write the sentence instead.
Keep prose to four sentences; a table is not prose.
If something was unavailable, say plainly which part of the question you could not answer.
If nothing was retrieved, say you cannot answer and do not speculate.`;
}

/** One streaming LLM call. Returns the token stream so the route can forward it. */
export function synthesize(
  question: string,
  outcomes: CallOutcome[],
  model = writer(),
  lang = 'en',
) {
  return streamText({ model, prompt: brief(question, outcomes, lang) });
}
