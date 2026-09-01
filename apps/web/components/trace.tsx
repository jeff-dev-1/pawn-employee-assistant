'use client';

import { AlertTriangle, Brain, Check, ChevronDown, ChevronUp, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import type { Stage } from '@/lib/use-assistant';
import { cn } from '@/lib/utils';

/**
 * The three stages as a timeline, not a spinner and not a paragraph.
 *
 * Two phases, because this architecture has two and not the four a tool-loop agent has:
 *
 *   Reason   one LLM call, which picks tools and says why
 *   Act      one card per MCP call, expandable to the record it returned
 *
 * A loop would have an Observe phase between Act and the answer - the model reading its own
 * tool results and deciding whether to go again. There is nothing to render here because the
 * writer goes straight from the records to prose, which is the whole point of splitting the
 * planner from the writer, and is worth saying out loud rather than filling with a fake step.
 */
export function Trace({ stages }: { stages: Stage[] }) {
  const [open, setOpen] = useState(true);
  if (stages.length === 0) return null;

  const failures = stages.filter((s) => s.kind === 'error');

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg py-1 text-sm text-muted transition hover:text-ink"
      >
        <Brain className="size-4 shrink-0" />
        <span>{open ? 'Hide' : 'View'} chain of thought</span>
        {!open && failures.length > 0 && (
          <span className="text-[var(--color-brand-red)]">· {failures.length} blocked</span>
        )}
        <span className="flex-1" />
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {open && (
        <ol className="mt-1 space-y-3 text-sm">
          {stages.map((stage, index) => (
            <li key={index}>{render(stage)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function render(stage: Stage) {
  if (stage.kind === 'plan') {
    return (
      <Phase icon={Brain} title="Reason" ms={stage.ms}>
        <p>
          {stage.tools.length === 0
            ? 'No tool in the catalog can answer this.'
            : (stage.reasoning ?? '')}
        </p>
        {stage.tools.length > 0 && (
          <p className="mt-1.5 italic">
            → Next: call {stage.tools.join(', ')}
            {stage.tools.length > 1 && ' — at once, not in sequence'}
          </p>
        )}
      </Phase>
    );
  }

  if (stage.kind === 'call') {
    return <ToolCard stage={stage} />;
  }

  const v = stage.verdict as
    | { action?: string; category?: string; profile?: string; detected?: string[] }
    | undefined;
  return (
    <div className="flex gap-2.5 text-[var(--color-brand-red)]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 break-words">
        {stage.stage && <span className="font-medium">{stage.stage}: </span>}
        {stage.message}
        {/* The scanner's own words. Without them "blocked" is an assertion. */}
        {v && (
          <pre className="mt-1.5 overflow-x-auto rounded-md border border-[var(--color-brand-red)]/30 bg-[var(--color-brand-red)]/5 p-2 text-[11px] leading-relaxed">
            {`action    ${v.action}\ncategory  ${v.category}\nprofile   ${v.profile}\ndetected  ${(v.detected ?? []).join(', ') || '-'}`}
          </pre>
        )}
      </div>
    </div>
  );
}

/** A phase heading with its duration, and the body indented behind a rule. */
function Phase({
  icon: Icon,
  title,
  ms,
  children,
}: {
  icon: typeof Brain;
  title: string;
  ms?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <p className="flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0 text-muted" />
        {title}
        {ms !== undefined && (
          <span className="font-mono text-xs text-muted">
            {ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms} ms`}
          </span>
        )}
      </p>
      <div className="mt-1 ms-2 border-s-2 border-line ps-4 text-muted">{children}</div>
    </>
  );
}

/** One MCP call. Collapsed it is a status line; opened it is the record the answer came from. */
function ToolCard({ stage }: { stage: Extract<Stage, { kind: 'call' }> }) {
  const [open, setOpen] = useState(false);
  const body = stage.ok ? stage.data : stage.detail;
  return (
    <>
      <p className="flex items-center gap-2 font-medium">
        <Wrench className="size-4 shrink-0 text-muted" />
        {stage.label}
      </p>
      <div className="mt-1 ms-2 border-s-2 border-line ps-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={body === undefined}
          className="flex w-full items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-start transition hover:border-ink/25 disabled:opacity-60"
        >
          <code className="font-mono text-xs">{stage.label}</code>
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              stage.ok ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]',
            )}
          >
            {stage.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {stage.ok ? 'Completed' : 'Failed'}
          </span>
          <span className="font-mono text-xs text-muted">{stage.ms} ms</span>
          <span className="flex-1" />
          {body !== undefined &&
            (open ? (
              <ChevronUp className="size-4 text-muted" />
            ) : (
              <ChevronDown className="size-4 text-muted" />
            ))}
        </button>
        {open && body !== undefined && (
          <pre className="mt-1.5 max-h-56 overflow-auto rounded-lg bg-surface p-2.5 font-mono text-[11px] leading-relaxed">
            {typeof body === 'string' ? body : JSON.stringify(body, null, 2)}
          </pre>
        )}
      </div>
    </>
  );
}
