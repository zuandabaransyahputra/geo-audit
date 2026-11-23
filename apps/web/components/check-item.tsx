import type { CheckResult } from '@geo-audit/core';
import Link from 'next/link';
import { CopyButton } from './copy-button';
import { Chevron } from './icons';
import { InlineMd } from './inline-md';
import { StatusIcon } from './status-badge';

/** `optOutHref`: offered on a warning ai-training-bots check, links to the same report with ?training=optout. */
export function CheckItem({ check, impact, optOutHref }: { check: CheckResult; impact?: number; optOutHref?: string }) {
  const open = check.status === 'fail';
  const hasBody = Boolean(check.fix || check.details?.length || check.why);
  const details = check.status === 'pass' ? check.details?.filter((d) => !/^allowed\s/.test(d)) : check.details;
  return (
    <details id={check.id} open={open} className="group scroll-mt-20 border-b border-border last:border-b-0">
      <summary className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5">
        <StatusIcon status={check.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{check.title}</span>
            {impact !== undefined && impact >= 0.5 && (
              <span className="font-mono text-xs text-muted-foreground">+{Math.round(impact)} pts</span>
            )}
          </div>
          <p className="mt-0.5 break-words text-sm text-muted-foreground">
            <InlineMd text={check.summary} />
          </p>
        </div>
        {hasBody && <Chevron className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />}
      </summary>
      {hasBody && (
        <div className="space-y-3 px-4 pb-4 pl-[3.25rem] text-sm sm:px-5 sm:pl-[3.5rem]">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Why it matters: </span>
            {check.why}
            {check.learnMore && (
              <>
                {' '}
                <Link href={`/insights/${check.learnMore}`} className="whitespace-nowrap font-medium text-primary underline-offset-4 hover:underline">
                  Learn more
                </Link>
              </>
            )}
          </p>
          {details && details.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed">
              {details.map((d) => (
                <li key={d} className={`break-words ${/^BLOCKED/.test(d) ? 'text-fail' : ''}`}>
                  <InlineMd text={d} />
                </li>
              ))}
            </ul>
          )}
          {check.fix && check.status !== 'pass' && (
            <div className="space-y-2">
              <p>
                <span className="font-medium">How to fix: </span>
                <InlineMd text={check.fix.text} />
              </p>
              {check.fix.snippet && (
                <div className="overflow-hidden rounded-lg border border-border bg-code">
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{check.fix.lang ?? 'code'}</span>
                    <CopyButton text={check.fix.snippet} className="px-2 py-1" />
                  </div>
                  <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
                    <code>{check.fix.snippet}</code>
                  </pre>
                </div>
              )}
              {optOutHref && check.id === 'ai-training-bots' && check.status === 'warn' && (
                <p>
                  <Link href={optOutHref} className="text-xs text-primary underline-offset-4 hover:underline">
                    I block these on purpose
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
