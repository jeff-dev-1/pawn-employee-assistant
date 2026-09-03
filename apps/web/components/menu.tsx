'use client';

import { Check } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * One button, one dropdown. Three side-by-side buttons per setting was fine with one setting
 * and stopped being fine with two: the header has a fixed height and a phone has 390px.
 */
export function Menu<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: T;
  options: { id: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  // Close on an outside click or Escape. Without both, a menu left open over the transcript
  // is the thing you have to explain while presenting.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <span ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className={cn(
          'grid size-9 place-items-center rounded-xl border transition sm:size-10',
          open
            ? 'border-[var(--primary)] text-[var(--primary)]'
            : 'border-line text-muted hover:border-ink/25 hover:text-ink',
        )}
      >
        {icon}
      </button>
      {open && (
        <span
          role="menu"
          className="absolute end-0 z-50 mt-1.5 grid min-w-40 gap-0.5 rounded-xl border border-line bg-card p-1.5 shadow-lg"
        >
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={value === o.id}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start text-sm whitespace-nowrap transition hover:bg-surface"
            >
              {o.icon}
              <span className="flex-1">{o.label}</span>
              {value === o.id && <Check className="size-4 text-[var(--primary)]" />}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
