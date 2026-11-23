import Link from 'next/link';
import { UrlForm } from './url-form';

export function ReportSkeleton({ host }: { host: string }) {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
          <div className="flex items-center gap-5">
            <div className="relative size-[148px] shrink-0">
              <div className="absolute inset-0 animate-spin rounded-full border-[10px] border-muted border-t-primary/60 [animation-duration:1.4s]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Auditing</p>
              <p className="mt-1 break-all text-xl font-semibold tracking-tight sm:text-2xl">{host}</p>
              <p className="mt-1 text-sm text-muted-foreground">Fetching the page, robots.txt, llms.txt and sitemap…</p>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="mb-1.5 h-3.5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-2 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </section>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      ))}
    </div>
  );
}

const TITLES: Record<string, string> = {
  invalid: 'That URL does not work',
  blocked: 'That URL cannot be audited',
  fetch: 'Could not fetch the page',
  'rate-limit': 'Slow down a little',
  error: 'Something went wrong',
};

export function ReportError({ kind, message, input }: { kind: string; message: string; input: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{TITLES[kind] ?? TITLES.error}</h1>
      <p className="mt-2 break-words text-muted-foreground">{message}</p>
      {kind === 'fetch' && (
        <p className="mt-2 text-sm text-muted-foreground">
          If the site blocks unknown bots, AI crawlers may be blocked too. That is worth checking in your firewall or CDN settings.
        </p>
      )}
      <div className="mt-6 flex justify-center">
        <UrlForm defaultValue={input} size="sm" />
      </div>
      <Link href="/" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        Back to start
      </Link>
    </div>
  );
}
