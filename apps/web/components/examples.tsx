'use client';

import { Lightbulb } from 'lucide-react';
import { EXAMPLES, isGroup, type Example, type Group, type Mode } from '@/components/mode-switch';

/**
 * The left column. Short titles on the cards, the question itself sent on click - a card that
 * carries the whole sentence is unreadable at the back of a room, and the sentence is going
 * to appear in the transcript a moment later anyway.
 */
export function Examples({
  mode,
  busy,
  onPick,
}: {
  mode: Mode;
  busy: boolean;
  onPick: (question: string) => void;
}) {
  return (
    <aside className="hidden overflow-y-auto border-e border-line bg-card p-5 md:block">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="size-5 text-[var(--primary)]" />
        Example questions
      </h2>
      <div className="space-y-3">
        {EXAMPLES[mode].map((item) =>
          isGroup(item) ? (
            <div key={item.title}>
              <div className="mb-1 flex items-center gap-2 py-1 text-sm font-semibold">
                <item.icon className="size-5 shrink-0 text-[var(--primary)]" />
                {item.title}
              </div>
              {/* A sequence, numbered, because the second turn only works after the first. */}
              <div className="space-y-1.5 border-s-2 border-[var(--primary)]/40 ps-4">
                {item.steps.map((step, i) => (
                  <Card key={step.title} item={step} index={i + 1} busy={busy} onPick={onPick} />
                ))}
              </div>
            </div>
          ) : (
            <Card key={item.title} item={item} busy={busy} onPick={onPick} />
          ),
        )}
      </div>
    </aside>
  );
}

function Card({
  item,
  index,
  busy,
  onPick,
}: {
  item: Example;
  index?: number;
  busy: boolean;
  onPick: (question: string) => void;
}) {
  return (
    <button
      type="button"
      title={item.text}
      disabled={busy}
      onClick={() => onPick(item.text)}
      className="flex w-full items-start gap-2.5 rounded-lg border border-line bg-card p-2.5 text-start transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 disabled:opacity-40"
    >
      {index === undefined ? (
        <item.icon className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" />
      ) : (
        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[var(--primary)]/15 text-[10px] font-semibold text-[var(--primary)]">
          {index}
        </span>
      )}
      <span className="text-sm leading-snug font-medium">{item.title}</span>
    </button>
  );
}

/** The same list, flattened, for the narrow layout where the column is hidden. */
export function flatten(items: (Example | Group)[]): Example[] {
  return items.flatMap((item) => (isGroup(item) ? item.steps : [item]));
}
