'use client';

import { useCallback, useRef, useState } from 'react';

export type Stage =
  | { kind: 'plan'; tools: string[]; reasoning: string; ms?: number }
  | { kind: 'call'; label: string; ok: boolean; ms: number; detail?: string; data?: unknown }
  | { kind: 'error'; stage: string; message: string; verdict?: unknown };

/** Where this turn can be read in the gateway's logs, when the ids are configured. */
export type Trace = { id: string; url?: string };

/** One question and everything that happened because of it. */
export type Usage = { in: number; out: number };
export type Turn = {
  question: string;
  stages: Stage[];
  answer: string;
  /** One entry per LLM call: the planner, then the writer. Two, always. */
  cost: { role: string; usage: Usage }[];
  trace?: Trace;
};

type Status = 'idle' | 'planning' | 'calling' | 'writing';

/** No SSE client library: the protocol is four event shapes, and parsing them is the point. */
export function useAssistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const running = useRef(false);

  // Every event lands on the turn that is still open - the last one.
  const patch = useCallback((fn: (turn: Turn) => Turn) => {
    setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)));
  }, []);

  const ask = useCallback(
    async (question: string, mode = 'normal') => {
      if (running.current || question.trim() === '') return;
      running.current = true;
      setTurns((all) => [...all, { question, stages: [], answer: '', cost: [] }]);
      setStatus('planning');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, mode }),
        });
        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            if (!frame.startsWith('data: ')) continue;
            const event = JSON.parse(frame.slice(6));

            if (event.type === 'plan') {
              setStatus('calling');
              patch((t) => ({
                ...t,
                stages: [
                  ...t.stages,
                  {
                    kind: 'plan',
                    tools: event.calls.map(
                      (c: { server: string; tool: string }) => `${c.server}.${c.tool}`,
                    ),
                    reasoning: event.reasoning ?? '',
                    ms: event.ms,
                  },
                ],
                cost: event.usage ? [...t.cost, { role: 'planner', usage: event.usage }] : t.cost,
                trace: event.trace ? { id: event.trace, url: event.traceUrl } : t.trace,
              }));
            } else if (event.type === 'execute') {
              patch((t) => ({
                ...t,
                stages: [
                  ...t.stages,
                  {
                    kind: 'call',
                    label: `${event.server}.${event.tool}`,
                    ok: event.ok,
                    ms: event.ms ?? 0,
                    detail: event.error,
                    data: event.data,
                  },
                ],
              }));
            } else if (event.type === 'answer') {
              setStatus('writing');
              patch((t) => ({
                ...t,
                answer: t.answer + event.delta,
                cost: event.usage ? [...t.cost, { role: 'writer', usage: event.usage }] : t.cost,
              }));
            } else if (event.type === 'error') {
              patch((t) => ({
                ...t,
                trace: event.trace ? { id: event.trace, url: event.traceUrl } : t.trace,
                stages: [
                  ...t.stages,
                  {
                    kind: 'error',
                    stage: event.stage ?? '',
                    message: event.message,
                    verdict: event.verdict,
                  },
                ],
              }));
            }
          }
        }
      } finally {
        running.current = false;
        setStatus('idle');
      }
    },
    [patch],
  );

  /** Switching mode must not leave the previous mode's verdict on screen. */
  const reset = useCallback(() => setTurns([]), []);

  return { ask, reset, turns, status, busy: status !== 'idle' };
}
