'use client';

import { useState } from 'react';
import { Streamdown } from 'streamdown';
import { ModeSwitch, QUESTIONS, type Mode } from '@/components/mode-switch';
import { PromptInput } from '@/components/prompt-input';
import { Trace } from '@/components/trace';
import { useAssistant } from '@/lib/use-assistant';

const LABEL: Record<string, string> = {
  planning: 'Deciding which records to consult…',
  calling: 'Reading the records…',
  writing: 'Composing the answer…',
};

export default function Home() {
  const [mode, setMode] = useState<Mode>('normal');
  const { ask, reset, turns, status, busy } = useAssistant();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">PAWN Employee Assistant</h1>
        <p className="mt-1 text-muted">
          One question, routed across HR, IT and company policy, answered from real records.
        </p>
      </header>

      <ModeSwitch
        mode={mode}
        onChange={(m) => {
          setMode(m);
          reset();
        }}
      />

      {/* The transcript. Each turn keeps its own trace, so two questions can be compared
          side by side rather than one overwriting the other. */}
      {turns.map((turn, index) => (
        <article key={index} className="mb-8">
          <p className="mb-3 ml-auto w-fit max-w-[85%] rounded-xl bg-ink px-4 py-2 text-white">
            {turn.question}
          </p>
          <Trace stages={turn.stages} />
          {turn.cost.length > 0 && (
            <dl className="mb-3 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-ink/[0.03] px-3 py-2 font-mono text-[11px] text-muted">
              <div>
                <dt className="inline text-ink">
                  {turn.cost.length} LLM call{turn.cost.length === 1 ? '' : 's'}
                </dt>
              </div>
              {turn.cost.map((c) => (
                <div key={c.role}>
                  <dt className="inline">{c.role}</dt>{' '}
                  {/* Not every vendor reports usage on a streamed response. Say which,
                      rather than printing a zero that reads like "free". */}
                  <dd className="inline text-ink">
                    {c.usage.in + c.usage.out === 0
                      ? 'not reported by the vendor'
                      : `${c.usage.in} in / ${c.usage.out} out`}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {turn.answer && (
            <div className="prose prose-neutral max-w-none leading-relaxed">
              <Streamdown>{turn.answer}</Streamdown>
            </div>
          )}
          {busy && index === turns.length - 1 && !turn.answer && (
            <p className="text-sm text-muted">{LABEL[status]}</p>
          )}
        </article>
      ))}

      <PromptInput onSubmit={(q) => ask(q, mode)} busy={busy} suggestions={QUESTIONS[mode]} />
    </main>
  );
}
