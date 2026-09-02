'use client';

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MODES, type Mode } from '@/components/mode-switch';
import { GraphProvider } from '@/components/workflow';
import { buildScript, type Channel, type Routing } from '@/lib/workflow-script';
import { cn } from '@/lib/utils';

const STEP_MS = 1600;

/**
 * The replay. Three switches across the top, a graph, a player, and a card that says what the
 * step actually is - because an animation nobody can narrate is decoration.
 *
 * Each switch is a real environment variable (see lib/workflow-script.ts). The picture cannot
 * show a configuration the system cannot be put into, which is the only reason a diagram like
 * this is worth keeping in a repository rather than in a slide deck.
 */
export function WorkflowReplay({
  mode,
  onMode,
  agents,
  onClose,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  agents: string[];
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<Channel>('portkey');
  const [routing, setRouting] = useState<Routing>('single');
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);

  // The same narrowing the script does, so the graph and the story never disagree.
  const effective: Routing = channel === 'portkey' ? routing : 'single';
  const script = useMemo(() => buildScript(mode, channel, routing), [mode, channel, routing]);
  const step = script[Math.min(at, script.length - 1)];

  // Changing any switch rewrites the script, so start it over rather than land mid-story.
  useEffect(() => {
    setAt(0);
    setPlaying(true);
  }, [mode, channel, routing]);

  useEffect(() => {
    if (!playing) return;
    if (at >= script.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setAt((i) => i + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, at, script.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === 'ArrowRight') setAt((i) => Math.min(i + 1, script.length - 1));
      if (e.key === 'ArrowLeft') setAt((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, script.length]);

  return (
    <div className="fixed inset-0 z-100 flex flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 sm:h-16 sm:px-5">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Workflow replay</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-10 place-items-center rounded-xl border border-line transition hover:border-ink/30"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* One scrolling row on a phone instead of three stacked ones: the switches are the
          control surface, and 128px of a 844px screen spent on them is the graph's budget. */}
      <div className="flex shrink-0 items-center gap-x-4 gap-y-2 overflow-x-auto border-b border-line px-4 py-2 sm:flex-wrap sm:gap-x-6 sm:px-5 sm:py-2.5">
        <Switch
          options={MODES.map((m) => ({ id: m.id, label: m.label.replace(/ (usage|mode)$/, '') }))}
          value={mode}
          onChange={(v) => onMode(v as Mode)}
        />
        <span className="flex shrink-0 items-center gap-2 sm:ms-auto">
          <span className="hidden font-mono text-[10px] tracking-widest text-muted uppercase sm:inline">
            LLM_PROVIDER
          </span>
          <Switch
            options={[
              { id: 'portkey', label: 'Portkey' },
              { id: 'direct', label: 'Direct' },
            ]}
            value={channel}
            onChange={(v) => setChannel(v as Channel)}
          />
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className="hidden font-mono text-[10px] tracking-widest text-muted uppercase sm:inline"
            title={
              channel === 'direct'
                ? 'Only the gateway can fall back. On direct the SDK talks to one vendor.'
                : undefined
            }
          >
            FALLBACK_VENDORS
          </span>
          <Switch
            options={[
              { id: 'single', label: 'Unset' },
              { id: 'fallback', label: 'Two vendors' },
            ]}
            value={effective}
            disabled={channel === 'direct'}
            onChange={(v) => setRouting(v as Routing)}
          />
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <GraphProvider
          channel={channel}
          routing={effective}
          agents={agents}
          activeEdge={step?.edge}
          failed={step?.tone === 'fail' && step.kind === 'LLM' ? step.focus : undefined}
        />

        {/* The narration. Without it the packets are pretty and mean nothing. */}
        {/* Floating over the graph is fine at 1440px and covers a third of it at 390px, so on a
            phone the narration sits under the graph where it can be read without hiding it. */}
        <aside className="pointer-events-none absolute inset-x-3 bottom-24 rounded-2xl border border-line bg-card/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-96 sm:max-w-[calc(100%-2rem)] sm:p-4">
          <p className="flex items-center gap-2 font-semibold">
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-full',
                step?.tone === 'fail'
                  ? 'bg-brand-red'
                  : step?.tone === 'warn'
                    ? 'bg-brand-orange'
                    : 'bg-brand-blue',
              )}
            />
            {step?.title}
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-widest text-muted uppercase">
            {step?.kind}
          </p>
          {step?.body && (
            <p className="mt-2 rounded-lg bg-surface p-2.5 text-xs leading-relaxed break-words">
              {step.body}
            </p>
          )}
        </aside>

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2 shadow-lg sm:bottom-5 sm:gap-3 sm:px-4 sm:py-2.5">
          <Key label="Restart" onClick={() => (setAt(0), setPlaying(true))} icon={RotateCcw} />
          <Key label="Previous" onClick={() => setAt((i) => Math.max(i - 1, 0))} icon={ChevronLeft} />
          <button
            type="button"
            onClick={() => (at >= script.length - 1 ? (setAt(0), setPlaying(true)) : setPlaying((p) => !p))}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid size-10 place-items-center rounded-full bg-[var(--primary)] text-white"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <Key
            label="Next"
            onClick={() => setAt((i) => Math.min(i + 1, script.length - 1))}
            icon={ChevronRight}
          />
          <span className="hidden h-1.5 w-56 overflow-hidden rounded-full bg-surface sm:block">
            <span
              className="block h-full rounded-full bg-[var(--primary)] transition-all"
              style={{ width: `${((at + 1) / script.length) * 100}%` }}
            />
          </span>
          <span className="w-11 text-end font-mono text-xs text-muted">
            {at + 1}/{script.length}
          </span>
        </div>
      </div>
    </div>
  );
}

function Key({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Play;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-muted transition hover:text-ink"
    >
      <Icon className="size-4" />
    </button>
  );
}

function Switch({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <span className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          disabled={disabled}
          className={cn(
            'rounded-lg border px-3 py-1 text-xs transition',
            'disabled:opacity-40',
            value === o.id
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-line text-muted hover:border-ink/25',
          )}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
