'use client';

import { ArrowUp, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { Example } from '@/components/mode-switch';

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

  function submit(question: string) {
    if (busy || question.trim() === '') return;
    setValue(question);
    onSubmit(question);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 md:hidden">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            title={suggestion.text}
            onClick={() => submit(suggestion.text)}
            disabled={busy}
            className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-40"
          >
            {suggestion.title}
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
          placeholder="Type your message here…"
          className="w-full bg-transparent px-1 py-1.5 outline-none placeholder:text-muted"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          {/* The route this question will take, named before it is asked. */}
          <span className="truncate font-mono text-[11px] text-muted">
            planner → 3 MCP servers → writer
          </span>
          <button
            type="submit"
            disabled={busy || value.trim() === ''}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white transition disabled:opacity-25"
            aria-label="Ask"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
