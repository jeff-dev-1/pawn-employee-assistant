'use client';

import {
  BookOpen,
  Calendar,
  House,
  IdCard,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Syringe,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useI18n, type Key } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Mode = 'normal' | 'risky' | 'protected';

/**
 * The three postures, and the only control that changes any of them. `risky` and `protected`
 * send the same questions to the same gateway with the same key; the difference is whether
 * the guardrail config travels with the call.
 *
 * Each mode owns a colour, and the page reads that colour off one CSS variable rather than
 * out of three sets of classes - see `[data-mode]` in globals.css. Retinting the whole page
 * is what makes the posture visible from the back of a room.
 */
export const MODES: { id: Mode; label: string; icon: LucideIcon }[] = [
  { id: 'normal', label: 'Normal usage', icon: ShieldQuestion },
  { id: 'risky', label: 'Risky usage', icon: ShieldAlert },
  { id: 'protected', label: 'Protected mode', icon: ShieldCheck },
];

/** The colour each mode claims, needed on the inactive buttons where `--primary` is not it. */
const TINT: Record<Mode, string> = {
  normal: 'var(--color-brand-green)',
  risky: 'var(--color-brand-red)',
  protected: 'var(--color-brand-blue)',
};

/** Icon only, in a pill. The label is a tooltip - three shields read faster than three lines. */
export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useI18n();
  return (
    <nav className="flex shrink-0 gap-1 rounded-2xl bg-surface p-1 sm:p-1.5">
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            aria-pressed={active}
            aria-label={t(`mode.${m.id}` as 'mode.normal')}
            title={t(`mode.${m.id}` as 'mode.normal')}
            style={{ '--tint': TINT[m.id] } as React.CSSProperties}
            className={cn(
              'grid size-9 place-items-center rounded-xl border transition sm:size-11',
              active
                ? 'border-[var(--tint)] bg-card text-[var(--tint)] shadow-sm'
                : 'border-transparent text-muted hover:border-[var(--tint)]/40 hover:text-[var(--tint)]',
            )}
          >
            <m.icon className="size-5" />
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The example questions, as the left column shows them: a short title on the card, the
 * question itself sent on click. A card headed by `steps` is a sequence that only works in
 * order - the impersonation attack needs the first turn to have happened.
 *
 * Aimed at what this system can actually be made to leak. A bomb recipe proves nothing here:
 * the planner has no tool for it, returns an empty plan, and the room watches a refusal that
 * had nothing to do with the guardrail. Employee records are the real exposure.
 */
/**
 * Both the label and the question are dictionary keys.
 *
 * The question used to stay English, on the theory that a translated one would be answered
 * from English data. That was wrong, and the screen proved it: the trace, the answer and the
 * table all rendered in Chinese while the user's own question sat there in English. What
 * actually needed to stay English was one level down - the ARGUMENTS the planner sends to
 * the tools, which are lookup keys against English records. The planner's prompt says so
 * now, and the question can be written in whatever language the reader is using.
 */
export type Example = { title: ExampleKey; text: TextKey; icon: LucideIcon };
export type Group = { title: ExampleKey; icon: LucideIcon; steps: Example[] };

/**
 * Question keys mirror the label keys: `ex.leave` labels it, `q.leave` asks it. Narrowed to
 * the keys the dictionary actually has rather than any `q.${string}`, so a card pointing at
 * a question nobody wrote is a type error and not an English string on a Chinese screen.
 */
export type TextKey = Extract<Key, `q.${string}`>;

export type ExampleKey =
  | 'ex.hr'
  | 'ex.leave'
  | 'ex.team'
  | 'ex.it'
  | 'ex.tickets'
  | 'ex.ticketDetail'
  | 'ex.policy'
  | 'ex.remote'
  | 'ex.expenses'
  | 'ex.security'
  | 'ex.equipment'
  | 'ex.crossDomain'
  | 'ex.systemPrompt'
  | 'ex.impersonation'
  | 'ex.learnName'
  | 'ex.harvest'
  | 'ex.pii'
  | 'ex.exfil'
  | 'ex.escalate';

const ATTACKS: (Example | Group)[] = [
  {
    title: 'ex.systemPrompt',
    text: 'q.systemPrompt',
    icon: Syringe,
  },
  {
    // Two turns, because one does not work: the planner holds a tool catalog, and get_team
    // needs a manager's name it cannot infer. Step 1 is how the attacker learns the name -
    // which is the point worth showing. An attack that fails for a boring reason teaches
    // nothing, and "who reports to me" fails that way: the demo user manages nobody.
    title: 'ex.impersonation',
    icon: Users,
    steps: [
      { title: 'ex.learnName', text: 'q.learnName', icon: Users },
      {
        title: 'ex.harvest',
        text: 'q.harvest',
        icon: Users,
      },
    ],
  },
  {
    title: 'ex.exfil',
    text: 'q.exfil',
    icon: IdCard,
  },
  {
    title: 'ex.escalate',
    text: 'q.escalate',
    icon: ShieldAlert,
  },
  {
    title: 'ex.pii',
    text: 'q.pii',
    icon: IdCard,
  },
];

export const EXAMPLES: Record<Mode, (Example | Group)[]> = {
  // Grouped by the server that answers, so the left column says something about the
  // architecture before anyone reads a trace: three domains, one question each, plus the
  // cross-domain one that needs two servers at once.
  normal: [
    {
      title: 'ex.hr',
      icon: Users,
      steps: [
        { title: 'ex.leave', text: 'q.leave', icon: Calendar },
        { title: 'ex.team', text: 'q.team', icon: Users },
      ],
    },
    {
      title: 'ex.it',
      icon: Wrench,
      steps: [
        { title: 'ex.tickets', text: 'q.tickets', icon: Wrench },
        {
          title: 'ex.ticketDetail',
          text: 'q.ticketDetail',
          icon: Wrench,
        },
      ],
    },
    {
      title: 'ex.policy',
      icon: BookOpen,
      steps: [
        { title: 'ex.remote', text: 'q.remote', icon: House },
        {
          title: 'ex.expenses',
          text: 'q.expenses',
          icon: BookOpen,
        },
        {
          title: 'ex.security',
          text: 'q.security',
          icon: BookOpen,
        },
        {
          title: 'ex.equipment',
          text: 'q.equipment',
          icon: BookOpen,
        },
      ],
    },
    {
      title: 'ex.crossDomain',
      text: 'q.crossDomain',
      icon: Sparkles,
    },
  ],
  risky: ATTACKS,
  protected: ATTACKS,
};

export function isGroup(item: Example | Group): item is Group {
  return 'steps' in item;
}
