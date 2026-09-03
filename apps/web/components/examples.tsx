'use client';

import { Lightbulb } from 'lucide-react';
import { EXAMPLES, isGroup, type Example, type Group, type Mode } from '@/components/mode-switch';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
  return (
    <aside className="hidden overflow-y-auto border-e border-line bg-card p-5 md:block">
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold">
        <Lightbulb className="size-[22px] text-[var(--primary)]" />
        {t('examples.title')}
      </h2>
      <div className="space-y-3">
        {EXAMPLES[mode].map((item) =>
          isGroup(item) ? (
            <div key={item.title}>
              <div className="mb-1.5 flex items-center gap-2.5 py-1 text-[15px] font-semibold">
                <item.icon className="size-[22px] shrink-0 text-[var(--primary)]" />
                {t(item.title)}
              </div>
              {/* A sequence, numbered, because the second turn only works after the first. */}
              <div className="space-y-2 border-s-2 border-[var(--primary)]/40 ps-4">
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
  const { t } = useI18n();
  return (
    <button
      type="button"
      title={item.text}
      disabled={busy}
      onClick={() => onPick(item.text)}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3 text-start transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 disabled:opacity-40"
    >
      {index === undefined ? (
        <item.icon className="size-[18px] shrink-0 text-[var(--primary)]" />
      ) : (
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--primary)]/15 text-[11px] font-semibold text-[var(--primary)]">
          {index}
        </span>
      )}
      <span className="text-[15px] leading-snug font-semibold">{t(item.title)}</span>
    </button>
  );
}

/** The same list, flattened, for the narrow layout where the column is hidden. */
export function flatten(items: (Example | Group)[]): Example[] {
  return items.flatMap((item) => (isGroup(item) ? item.steps : [item]));
}
