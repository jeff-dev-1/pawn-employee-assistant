'use client';

import { ArrowUp, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { Example } from '@/components/mode-switch';
import { useI18n } from '@/lib/i18n';

export function PromptInput({
  onSubmit,
  busy,
  suggestions,
}: {
  onSubmit: (question: string) => void;
  busy: boolean;
  /** Shown only where the example column is hidden, so a phone still has one tap per demo. */
  suggestions: Example[];
}) {
  const [value, setValue] = useState('');
  const { t } = useI18n();

  function submit(question: string) {
    if (busy || question.trim() === '') return;
    // Clear, do not echo. Setting the box to what was just asked was written for the
    // suggestion cards and reads as "your question was not accepted" for a typed one -
    // the question is already in the transcript a line above.
    setValue('');
    onSubmit(question);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 md:hidden">
        {suggestions.map((suggestion) => (
          <button
            key={t(suggestion.title)}
            type="button"
            title={t(suggestion.text)}
            onClick={() => submit(t(suggestion.text))}
            disabled={busy}
            className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40"
          >
            {t(suggestion.title)}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="rounded-2xl border border-line bg-card p-3 shadow-sm transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15"
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('input.placeholder')}
          className="w-full bg-transparent px-1 py-1.5 outline-none placeholder:text-muted"
        />
        <div className="mt-2 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={busy || value.trim() === ''}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white transition disabled:opacity-25"
            aria-label={t('input.send')}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
