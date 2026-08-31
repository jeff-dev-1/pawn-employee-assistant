'use client';

import { ArrowUp, Loader2 } from 'lucide-react';
import { useState } from 'react';

const SUGGESTIONS = [
  'How many vacation days do I have left?',
  'What is the remote work policy?',
  'Who is my manager, and what tickets have I opened?',
];

export function PromptInput({
  onSubmit,
  busy,
}: {
  onSubmit: (question: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState('');

  function submit(question: string) {
    if (busy || question.trim() === '') return;
    setValue(question);
    onSubmit(question);
  }

  return (
    <div className="mb-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-2 rounded-xl border border-line bg-white p-2 shadow-sm focus-within:border-ink/30"
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ask about HR, IT, or company policy"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy || value.trim() === ''}
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-white transition disabled:opacity-25"
          aria-label="Ask"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => submit(suggestion)}
            disabled={busy}
            className="rounded-full border border-line bg-white px-3 py-1 text-xs text-muted transition hover:border-ink/25 hover:text-ink disabled:opacity-40"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
