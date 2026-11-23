import type { Metadata } from 'next';
import Link from 'next/link';
import { allArticles, formatDate } from '@/lib/insights';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Insights: GEO and AI search, explained',
  description: 'Short, practical guides to getting found and cited by ChatGPT, Claude, Perplexity and Google AI Overviews: crawlers, llms.txt, JSON-LD, rendering and measurement.',
  alternates: { canonical: '/insights' },
  openGraph: { url: '/insights', title: 'Insights: GEO and AI search, explained' },
};

export default function InsightsIndex() {
  const articles = allArticles();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/insights#page`,
        name: 'GEO Audit Insights',
        url: `${SITE_URL}/insights`,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        hasPart: articles.map((a) => ({ '@type': 'BlogPosting', headline: a.title, url: `${SITE_URL}/insights/${a.slug}` })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'GEO Audit', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Insights', item: `${SITE_URL}/insights` },
        ],
      },
    ],
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Insights</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">GEO and AI search, explained</h1>
        <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">
          Short, practical guides to getting your site found, read and cited by ChatGPT, Claude, Perplexity and Google AI Overviews. No
          hype, no made-up statistics: what the vendors document and what you can change today.
        </p>
      </header>
      <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {articles.map((a, i) => (
          <li key={a.slug}>
            <Link
              href={`/insights/${a.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-ring/50 sm:p-6"
            >
              <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight group-hover:text-primary">{a.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
              <p className="mt-auto pt-4 text-xs text-muted-foreground">
                {formatDate(a.published)} · {a.readingMinutes} min read
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
