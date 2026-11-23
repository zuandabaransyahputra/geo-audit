import { capMessage, impact, type Report } from '@geo-audit/core';
import { CheckItem } from './check-item';
import { CopyButton } from './copy-button';
import { HireCta } from './hire-cta';
import { ActionPlanPanel, StrengthsPanel, VisibilityPanel } from './insight-panels';
import { LinkIcon } from './icons';
import { ScoreRing, scoreTone } from './score-ring';

const BAR = { pass: 'bg-pass', warn: 'bg-warn', fail: 'bg-fail' };
const TEXT = { pass: 'text-pass', warn: 'text-warn', fail: 'text-fail' };

const VERDICT: Record<string, string> = {
  A: 'Ready for AI search. A few polish items at most.',
  B: 'In good shape, with some gaps worth closing.',
  C: 'Findable, but assistants will miss or misread parts of it.',
  D: 'Significant gaps: assistants may skip or misquote this site.',
  F: 'Largely invisible to AI search right now.',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
}

export function ReportView({ report, markdown }: { report: Report; markdown: string }) {
  const tone = scoreTone(report.score);
  const counts = report.categories
    .flatMap((c) => c.checks)
    .reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
          <div>
          <div className="flex items-center gap-5">
            <ScoreRing score={report.score} grade={report.grade} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-9 items-center justify-center rounded-lg text-lg font-semibold ${tone === 'pass' ? 'bg-pass-soft text-pass' : tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-fail-soft text-fail'}`}>
                  {report.grade}
                </span>
                <span className="text-sm text-muted-foreground">grade</span>
              </div>
              <h1 className="mt-2 break-all text-xl font-semibold tracking-tight sm:text-2xl">{report.domain}</h1>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">{VERDICT[report.grade]}</p>
            </div>
          </div>
          {report.cap && (
            <p className="mt-4 max-w-sm rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" role="note">
              {capMessage(report.cap, report.rawScore)}
            </p>
          )}
          </div>
          <div className="flex-1 space-y-3">
            {report.categories.map((c) => {
              const t = scoreTone(c.score);
              return (
                <a key={c.id} href={`#${c.id}`} className="group block">
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium group-hover:underline group-hover:underline-offset-4">{c.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      <span className={`text-sm font-semibold ${TEXT[t]}`}>{c.score}</span> · {Math.round(c.weight * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${BAR[t]}`} style={{ width: `${Math.max(2, c.score)}%` }} />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-pretty text-[15px] leading-relaxed">{report.insights.summary}</p>
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="break-all">
            <a href={report.finalUrl} className="hover:text-foreground" rel="nofollow noopener">
              {report.finalUrl}
            </a>{' '}
            · HTTP {report.page.status}
            {report.page.redirects.length > 0 && ` · ${report.page.redirects.length} redirect${report.page.redirects.length > 1 ? 's' : ''}`} · <span className="whitespace-nowrap">{formatDate(report.fetchedAt)}</span>
            <span className="whitespace-nowrap">
              {' '}
              · {counts.pass ?? 0} passed, {counts.warn ?? 0} warnings, {counts.fail ?? 0} failed
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <CopyButton text="__LOCATION__" label="Copy link" icon={<LinkIcon className="size-3.5" />} variant="outline" className="h-8 px-3" />
            <CopyButton text={markdown} label="Copy as Markdown" variant="solid" className="h-8 px-3" />
          </div>
        </div>
      </section>

      <VisibilityPanel items={report.insights.visibility} />
      <ActionPlanPanel plan={report.insights.plan} />
      <StrengthsPanel items={report.insights.strengths} />

      <HireCta />

      {report.categories.map((c) => (
        <section key={c.id} id={c.id} className="scroll-mt-20" aria-labelledby={`${c.id}-title`}>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id={`${c.id}-title`} className="text-lg font-semibold tracking-tight">
                {c.label}
              </h2>
              <p className="text-sm text-muted-foreground">{c.description}</p>
            </div>
            <p className="shrink-0 text-right font-mono text-xs text-muted-foreground">
              <span className={`text-lg font-semibold ${TEXT[scoreTone(c.score)]}`}>{c.score}</span>/100
              <span className="block">weight {Math.round(c.weight * 100)}%</span>
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {c.checks.map((check) => (
              <CheckItem key={check.id} check={check} impact={check.status === 'pass' || check.status === 'info' ? undefined : impact(check, report.categories)} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-center text-xs text-muted-foreground">
        Results are cached for 10 minutes. GEO Audit v{report.toolVersion} checks the page as an AI crawler sees it: initial HTML, no JavaScript.
      </p>
    </div>
  );
}
