import { points, type ActionItem, type Insights, type Visibility } from '@geo-audit/core';
import Link from 'next/link';
import { Check } from './icons';

const VIS_STYLE: Record<Visibility, { label: string; pill: string; dot: string }> = {
  visible: { label: 'Visible', pill: 'bg-pass-soft text-pass', dot: 'bg-pass' },
  partly: { label: 'Partly', pill: 'bg-warn-soft text-warn', dot: 'bg-warn' },
  blocked: { label: 'Blocked', pill: 'bg-fail-soft text-fail', dot: 'bg-fail' },
};

export function VisibilityPanel({ items }: { items: Insights['visibility'] }) {
  return (
    <section aria-labelledby="who-can-see-you">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="who-can-see-you" className="text-lg font-semibold tracking-tight">
            Who can see you
          </h2>
          <p className="text-sm text-muted-foreground">Per AI product, from robots.txt rules for its crawlers, indexing directives and server-rendered content.</p>
        </div>
        <Link href="/insights/ai-crawlers-robots-txt" className="hidden shrink-0 text-sm text-primary underline-offset-4 hover:underline sm:block">
          How this works
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {items.map((v) => {
          const s = VIS_STYLE[v.status];
          return (
            <li key={v.id} className="flex flex-col rounded-xl border border-border bg-card px-4 py-3 shadow-sm sm:rounded-2xl sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium leading-snug">{v.product}</span>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.pill}`}>
                  <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
                  {s.label}
                </span>
              </div>
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{v.role}</p>
              <p className="mt-1.5 text-sm text-muted-foreground sm:mt-3 sm:text-foreground">{v.reason}</p>
              <div className="mt-auto hidden flex-wrap gap-1 pt-3 sm:flex">
                {v.crawlers.map((c) => (
                  <a
                    key={c.token}
                    href={v.docs}
                    rel="noopener"
                    title={`${c.token}: ${c.allowed ? 'allowed' : 'blocked'}${c.primary ? '' : ' (secondary)'}`}
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${c.allowed ? 'bg-muted text-muted-foreground' : 'bg-fail-soft text-fail line-through'}`}
                  >
                    {c.token}
                  </a>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const GROUPS: { key: 'quickWins' | 'thisWeek' | 'bigger' | 'optional'; label: string; hint: string }[] = [
  { key: 'quickWins', label: 'Quick wins', hint: 'minutes each' },
  { key: 'thisWeek', label: 'This week', hint: 'hours each' },
  { key: 'bigger', label: 'Bigger projects', hint: 'days' },
  { key: 'optional', label: 'Optional: agent readiness', hint: 'not scored' },
];

function PlanItem({ item }: { item: ActionItem }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <a href={`#${item.id}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.status === 'fail' ? 'bg-fail' : item.status === 'warn' ? 'bg-warn' : 'bg-info'}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{item.title}</span>
          <span className="block truncate text-sm text-muted-foreground">{item.summary.replace(/`/g, '')}</span>
        </span>
        <span className="shrink-0 text-right">
          {item.category === 'agent-readiness' ? (
            <span className="block font-mono text-xs text-muted-foreground">optional</span>
          ) : (
            <span className="block font-mono text-xs font-semibold text-pass">+{points(item.points)} pts</span>
          )}
          <span className="block text-[11px] text-muted-foreground">{item.effortLabel}</span>
        </span>
      </a>
    </li>
  );
}

export function ActionPlanPanel({ plan }: { plan: Insights['plan'] }) {
  const scored = plan.quickWins.length + plan.thisWeek.length + plan.bigger.length > 0;
  if (!scored && !plan.optional.length) return null;
  return (
    <section aria-labelledby="action-plan">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="action-plan" className="text-lg font-semibold tracking-tight">
            Action plan
          </h2>
          <p className="text-sm text-muted-foreground">Ordered by points gained per effort. Points and effort are estimates.</p>
        </div>
        {scored && (
        <dl className="flex items-end gap-3 text-center" aria-label="Projected score">
          <div>
            <dt className="text-[11px] text-muted-foreground">Now</dt>
            <dd className="font-mono text-lg font-semibold">{plan.current}</dd>
          </div>
          {plan.quickWins.length > 0 && (
            <>
              <span className="pb-1 text-muted-foreground" aria-hidden>
                →
              </span>
              <div>
                <dt className="text-[11px] text-muted-foreground">After quick wins</dt>
                <dd className="font-mono text-lg font-semibold">~{plan.afterQuickWins}</dd>
              </div>
            </>
          )}
          <span className="pb-1 text-muted-foreground" aria-hidden>
            →
          </span>
          <div>
            <dt className="text-[11px] text-muted-foreground">Full plan</dt>
            <dd className="font-mono text-lg font-semibold text-pass">≤{plan.afterAll}</dd>
          </div>
        </dl>
        )}
      </div>
      <div className="space-y-4">
        {GROUPS.map((g) => {
          const items = plan[g.key];
          if (!items.length) return null;
          return (
            <div key={g.key}>
              <div className="mb-2 flex items-baseline gap-2 text-sm">
                <h3 className="font-semibold">{g.label}</h3>
                <span className="text-muted-foreground">{g.hint}</span>
              </div>
              <ol className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {items.map((i) => (
                  <PlanItem key={i.id} item={i} />
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StrengthsPanel({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="strengths">
      <h2 id="strengths" className="mb-3 text-lg font-semibold tracking-tight">
        Strengths
      </h2>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm sm:grid-cols-2 sm:p-5">
        {items.map((s) => (
          <li key={s} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-pass" strokeWidth={2.5} />
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}
