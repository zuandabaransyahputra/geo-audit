import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ReportView } from '@/components/report-view';
import { ReportError, ReportSkeleton } from '@/components/report-states';
import { UrlForm } from '@/components/url-form';
import { clientIp, getReport, parseTarget } from '@/lib/run-audit';
import { reportHref } from '@/lib/site';
import { cardQuery } from '@/lib/og-card';

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const input = first((await searchParams).url);
  const target = parseTarget(input);
  if (!target.ok) return { title: 'Report', robots: { index: false } };
  const host = target.url.hostname;
  // Shares the page render's audit (same cache and in-flight request), so this adds no extra fetch.
  const outcome = await getReport(target.url.href, clientIp(await headers()));
  const title = outcome.ok ? `GEO report for ${host}: ${outcome.report.score}/100 (grade ${outcome.report.grade})` : `GEO report for ${host}`;
  const description = `How well can ChatGPT, Claude, Perplexity and Google AI Overviews find, read and cite ${host}? Score, category breakdown and fixes.`;
  const og = outcome.ok ? `/api/og?${cardQuery(outcome.report)}` : `/api/og?d=${encodeURIComponent(host.replace(/^www\./, ''))}`;
  return {
    title,
    description,
    // Reports are user-generated and change; keep them out of search indexes.
    robots: { index: false, follow: true },
    alternates: { canonical: reportHref(target.url.href) },
    openGraph: { title, description, url: reportHref(target.url.href), images: [{ url: og, width: 1200, height: 630, alt: `GEO Audit score for ${host}` }] },
    twitter: { card: 'summary_large_image', title, description, images: [og] },
  };
}

async function ReportBody({ input }: { input: string }) {
  const ip = clientIp(await headers());
  const outcome = await getReport(input, ip);
  if (!outcome.ok) return <ReportError kind={outcome.kind} message={outcome.message} input={input} />;
  return <ReportView report={outcome.report} markdown={outcome.markdown} />;
}

export default async function ReportPage({ searchParams }: Props) {
  const input = first((await searchParams).url);
  if (!input) redirect('/');
  const target = parseTarget(input);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex justify-end">
        <UrlForm defaultValue={target.ok ? target.url.href : input} size="sm" />
      </div>
      {target.ok ? (
        <Suspense key={target.url.href} fallback={<ReportSkeleton host={target.url.hostname} />}>
          <ReportBody input={target.url.href} />
        </Suspense>
      ) : (
        <ReportError kind="invalid" message={target.message} input={input} />
      )}
    </div>
  );
}
