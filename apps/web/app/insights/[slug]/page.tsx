import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UrlForm } from '@/components/url-form';
import { ARTICLES, formatDate, getArticle } from '@/lib/insights';
import { AUTHOR_NAME, AUTHOR_URL, HIRE_URL, SITE_URL } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = getArticle((await params).slug);
  if (!a) return {};
  const url = `/insights/${a.slug}`;
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: url },
    authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
    openGraph: {
      type: 'article',
      url,
      title: a.title,
      description: a.description,
      publishedTime: a.published,
      modifiedTime: a.updated ?? a.published,
      authors: [AUTHOR_URL],
    },
    twitter: { card: 'summary_large_image', title: a.title, description: a.description },
  };
}

export default async function ArticlePage({ params }: Props) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const url = `${SITE_URL}/insights/${a.slug}`;
  const at = ARTICLES.findIndex((x) => x.slug === a.slug);
  const more = [1, 2, 3].map((n) => ARTICLES[(at + n) % ARTICLES.length]!);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: a.title,
        description: a.description,
        url,
        mainEntityOfPage: url,
        datePublished: a.published,
        dateModified: a.updated ?? a.published,
        wordCount: a.words,
        inLanguage: 'en',
        image: `${url}/opengraph-image`,
        author: { '@type': 'Person', '@id': `${AUTHOR_URL}/#person`, name: AUTHOR_NAME, url: AUTHOR_URL },
        publisher: { '@type': 'Person', '@id': `${AUTHOR_URL}/#person`, name: AUTHOR_NAME, url: AUTHOR_URL },
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'GEO Audit', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Insights', item: `${SITE_URL}/insights` },
          { '@type': 'ListItem', position: 3, name: a.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/insights" className="hover:text-foreground">
          Insights
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span className="text-foreground/80">{a.title}</span>
      </nav>

      <header className="mt-6 max-w-3xl">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.15]">{a.title}</h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">{a.description}</p>
        <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>
            By{' '}
            <a href={AUTHOR_URL} rel="author" className="font-medium text-foreground underline-offset-4 hover:underline">
              {AUTHOR_NAME}
            </a>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={a.updated ?? a.published}>{a.updated ? `Updated ${formatDate(a.updated)}` : formatDate(a.published)}</time>
          <span aria-hidden>·</span>
          <span>{a.readingMinutes} min read</span>
        </p>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          {a.toc.length > 2 && (
            <details className="mb-8 rounded-xl border border-border bg-card p-4 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium">On this page</summary>
              <ol className="mt-3 space-y-1.5 text-sm">
                {a.toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="text-muted-foreground hover:text-foreground">
                      {t.text}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <article className="prose" dangerouslySetInnerHTML={{ __html: a.html }} />

          <aside className="mt-14 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold tracking-tight">Check your site</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              See how ChatGPT, Claude, Perplexity and Google AI Overviews see your pages, with a score and fixes in a few seconds.
            </p>
            <div className="mt-4">
              <UrlForm size="sm" />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Want someone to do it for you?{' '}
              <a href={HIRE_URL} className="font-medium text-primary underline-offset-4 hover:underline">
                Hire {AUTHOR_NAME.split(' ')[0]}
              </a>
              , a freelance web developer.
            </p>
          </aside>

          <nav aria-label="More insights" className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">More insights</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {more.map((m) => (
                <li key={m.slug}>
                  <Link href={`/insights/${m.slug}`} className="block py-3 font-medium hover:text-primary">
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {a.toc.length > 2 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
              <ol className="mt-3 space-y-2 border-l border-border text-sm">
                {a.toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="-ml-px block border-l border-transparent pl-3 text-muted-foreground hover:border-foreground hover:text-foreground">
                      {t.text}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
