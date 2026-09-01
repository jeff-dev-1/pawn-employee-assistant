'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';
import { Examples, flatten } from '@/components/examples';
import { EXAMPLES, MODES, ModeSwitch, type Mode } from '@/components/mode-switch';
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
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? '';
  const end = useRef<HTMLDivElement>(null);

  // Follow the stream. Without this the answer writes itself off the bottom of the screen.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  return (
    // data-mode retints --primary for everything below it, so the posture is one attribute.
    <div data-mode={mode} className="flex h-dvh flex-col">
      <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-line bg-card px-5">
        <span className="flex items-center gap-2.5">
          <Sparkles className="size-8 text-[var(--primary)] transition-colors" />
          <span className="text-2xl font-semibold tracking-tight">PAWN Assistant</span>
        </span>
        <ModeSwitch
          mode={mode}
          onChange={(m) => {
            setMode(m);
            reset();
          }}
        />
        {/* Balances the brand so the switcher sits centred. Nothing lives here yet. */}
        <span className="hidden w-52 sm:block" />
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[320px_1fr]">
        <Examples mode={mode} busy={busy} onPick={(q) => ask(q, mode)} />

        <section className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto max-w-3xl">
              {turns.length === 0 && (
                <p className="text-muted">
                  One question, routed across HR, IT and company policy, answered from real
                  records.
                </p>
              )}

              {/* The transcript. Each turn keeps its own trace, so two questions can be
                  compared side by side rather than one overwriting the other. */}
              {turns.map((turn, index) => (
                <article key={index} className="mb-8">
                  {index === 0 && (
                    <p className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-wider text-[var(--primary)] uppercase">
                      <span className="size-2 rounded-full bg-[var(--primary)]" />
                      {modeLabel}
                      <span className="h-px flex-1 bg-line" />
                    </p>
                  )}
                  <p className="mb-4 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--primary)] px-4 py-2 text-white shadow-sm">
                    {turn.question}
                  </p>
                  <Trace stages={turn.stages} />
                  {turn.cost.length > 0 && (
                    <dl className="mb-4 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-surface px-3 py-2 font-mono text-[11px] text-muted">
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
                    <div className="prose prose-neutral max-w-none rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 leading-relaxed shadow-sm">
                      <Streamdown>{turn.answer}</Streamdown>
                    </div>
                  )}
                  {busy && index === turns.length - 1 && !turn.answer && (
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <span className="size-2 animate-pulse rounded-full bg-[var(--primary)]" />
                      {LABEL[status]}
                    </p>
                  )}
                </article>
              ))}
              <div ref={end} />
            </div>
          </div>

          <div className="shrink-0 px-6 pb-6">
            <div className="mx-auto max-w-3xl">
              <PromptInput
                onSubmit={(q) => ask(q, mode)}
                busy={busy}
                suggestions={flatten(EXAMPLES[mode])}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
