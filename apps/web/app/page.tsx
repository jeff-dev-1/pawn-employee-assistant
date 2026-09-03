'use client';

import {
  Check,
  Copy as CopyIcon,
  ExternalLink,
  Languages,
  Monitor,
  Moon,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';
import { Examples, flatten } from '@/components/examples';
import { EXAMPLES, MODES, ModeSwitch, type Mode } from '@/components/mode-switch';
import { PromptInput } from '@/components/prompt-input';
import { Menu } from '@/components/menu';
import { Trace } from '@/components/trace';
import { LANGS, useI18n, type Lang } from '@/lib/i18n';
import { useAssistant } from '@/lib/use-assistant';

export default function Home() {
  const [mode, setMode] = useState<Mode>('normal');
  const { ask, reset, turns, status, busy } = useAssistant();
  const { lang, setLang, t } = useI18n();
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? '';
  const end = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>('system');

  // Restoring before first paint would need a blocking script tag in <head>; one frame of
  // the system theme is the cheaper trade for a demo.
  useEffect(() => {
    const saved = localStorage.getItem('pawn-theme') as Theme | null;
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pawn-theme', theme);
  }, [theme]);


  // Follow the stream. Without this the answer writes itself off the bottom of the screen.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  return (
    // data-mode retints --primary for everything below it, so the posture is one attribute.
    <div data-mode={mode} className="flex h-dvh flex-col">
      {/* On a phone the three header blocks want 562px of a 390px viewport. The wordmark and
          the theme switch are the two that carry no information the room needs mid-demo, so
          they are the two that go; the mode switch never does, because it is the demo. */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line bg-card px-3 sm:h-20 sm:gap-4 sm:px-5">
        <span className="flex items-center gap-2.5">
          <Sparkles className="size-7 shrink-0 text-[var(--primary)] transition-colors sm:size-8" />
          <span className="hidden text-2xl font-semibold tracking-tight sm:inline">
            {t('app.name')}
          </span>
        </span>
        <ModeSwitch
          mode={mode}
          onChange={(m) => {
            setMode(m);
            reset();
          }}
        />
        <span className="flex items-center justify-end gap-1 sm:w-52">
          <Menu
            icon={<ThemeIcon theme={theme} />}
            label={t('theme.title')}
            value={theme}
            onChange={setTheme}
            options={THEMES.map((x) => ({
              id: x.id,
              label: t(`theme.${x.id}` as 'theme.system'),
              icon: <x.icon className="size-4" />,
            }))}
          />
          <Menu
            icon={<Languages className="size-4" />}
            label={t('lang.title')}
            value={lang}
            onChange={setLang}
            options={LANGS.map((l) => ({ id: l.id as Lang, label: l.label }))}
          />
        </span>
      </header>


      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[320px_1fr]">
        <Examples mode={mode} busy={busy} onPick={(q) => ask(q, mode, lang)} />

        <section className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto max-w-3xl">
              {/* An empty transcript is the first thing a room sees. A line of grey text
                  says nothing; the mark and a greeting say what this is and who it thinks
                  you are - and DEMO_USER is the honest answer to the second half. */}
              {turns.length === 0 && (
                <div className="grid place-items-center gap-5 py-16 text-center">
                  <Sparkles className="size-16 text-[var(--primary)] opacity-90" />
                  <p className="max-w-md text-muted">{t('app.tagline')}</p>
                </div>
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
                  {/* Quiet, like a chat client. The mode already has the header, the divider
                      and every accent on the page; a saturated pill on top of that shouts. */}
                  <p className="mb-5 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-surface px-4 py-2">
                    {turn.question}
                  </p>
                  <Trace stages={turn.stages} />
                  {turn.answer && (
                    <div className="answer">
                      <Streamdown>{turn.answer}</Streamdown>
                    </div>
                  )}
                  {/* Under the answer, where a reader looks after reading it - not wedged
                      between the trace and the thing the trace is about. */}
                  {turn.cost.length > 0 && (
                    <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-muted">
                      <dt className="text-ink">
                        {turn.cost.length} {t('cost.calls')}
                          {lang === 'en' && turn.cost.length !== 1 ? 's' : ''}
                      </dt>
                      {turn.cost.map((c) => (
                        <div key={c.role}>
                          <dt className="inline">{c.role}</dt>{' '}
                          {/* Not every vendor reports usage on a streamed response. Say which,
                              rather than printing a zero that reads like "free". */}
                          <dd className="inline text-ink">
                            {c.usage.in + c.usage.out === 0
                              ? t('cost.unreported')
                              : `${c.usage.in} in / ${c.usage.out} out`}
                          </dd>
                        </div>
                      ))}
                      <span className="flex-1" />
                      {/* The id is not the point; opening the row is. Printed as text it is
                          something to read aloud, and nobody in the room can act on it. */}
                      {turn.trace?.url && (
                        <a
                          href={turn.trace.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 transition hover:text-ink"
                        >
                          <ExternalLink className="size-3" />
                          trace
                        </a>
                      )}
                      {turn.trace && !turn.trace.url && <span>trace {turn.trace.id.slice(0, 8)}</span>}
                      {turn.answer && <Copy text={turn.answer} label={t('cost.copy')} />}
                    </dl>
                  )}
                  {busy && index === turns.length - 1 && !turn.answer && (
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <span className="size-2 animate-pulse rounded-full bg-[var(--primary)]" />
                      {t(`status.${status}` as 'status.planning')}
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
                onSubmit={(q) => ask(q, mode, lang)}
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

/** Copying the answer is the one action a reader in a demo actually wants. */
function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="grid size-7 place-items-center rounded-lg text-muted transition hover:text-ink"
    >
      {done ? <Check className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </button>
  );
}

export type Theme = 'system' | 'light' | 'dark';
const THEMES: { id: Theme; icon: typeof Sun; label: string }[] = [
  { id: 'system', icon: Monitor, label: 'System' },
  { id: 'light', icon: Sun, label: 'Light' },
  { id: 'dark', icon: Moon, label: 'Dark' },
];

/** The trigger shows the state; the menu holds the choices. */
function ThemeIcon({ theme }: { theme: Theme }) {
  const Icon = THEMES.find((t) => t.id === theme)?.icon ?? Monitor;
  return <Icon className="size-4" />;
}
