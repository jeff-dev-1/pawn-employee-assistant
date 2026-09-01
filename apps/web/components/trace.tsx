import { AlertTriangle, Check, Route, X } from 'lucide-react';
import type { Stage } from '@/lib/use-assistant';
import { cn } from '@/lib/utils';

/** The three stages, made visible. A spinner would tell the user nothing. */
export function Trace({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;

  return (
    <ol className="mb-8 space-y-2 rounded-xl border border-line bg-white/60 p-4 text-sm">
      {stages.map((stage, index) => {
        if (stage.kind === 'plan') {
          return (
            <li key={index} className="flex gap-3">
              <Route className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted">
                    {stage.tools.length === 0 ? 'No tool can answer this' : 'Planned'}
                  </span>
                  {stage.tools.map((tool) => (
                    <code
                      key={tool}
                      className="rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-xs text-ink"
                    >
                      {tool}
                    </code>
                  ))}
                </div>
                {stage.reasoning && <p className="mt-1 text-muted">{stage.reasoning}</p>}
              </div>
            </li>
          );
        }

        if (stage.kind === 'call') {
          return (
            <li key={index} className="flex items-center gap-3">
              {stage.ok ? (
                <Check className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <X className="size-4 shrink-0 text-accent" />
              )}
              <code className="font-mono text-xs text-ink">{stage.label}</code>
              <span className={cn('text-xs', stage.ok ? 'text-muted' : 'text-accent')}>
                {stage.ok ? `${stage.ms} ms` : (stage.detail ?? 'failed')}
              </span>
            </li>
          );
        }

        const v = stage.verdict as
          | { action?: string; category?: string; profile?: string; detected?: string[] }
          | undefined;
        return (
          <li key={index} className="flex gap-3 text-accent">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 break-words">
              {stage.stage && <span className="font-medium">{stage.stage}: </span>}
              {stage.message}
              {/* The scanner's own words. Without them "blocked" is an assertion. */}
              {v && (
                <pre className="mt-1.5 overflow-x-auto rounded-md bg-accent/5 p-2 text-[11px] leading-relaxed">
                  {`action    ${v.action}\ncategory  ${v.category}\nprofile   ${v.profile}\ndetected  ${(v.detected ?? []).join(', ') || '-'}`}
                </pre>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
