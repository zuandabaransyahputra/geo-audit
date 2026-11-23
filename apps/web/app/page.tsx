import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import { UrlForm } from '@/components/url-form';
import { AUTHOR_NAME, AUTHOR_URL, EXAMPLES, REPO_URL, SITE_URL, reportHref } from '@/lib/site';

const CATEGORIES = [
  {
    name: 'AI access',
    weight: 30,
    blurb: 'Can the crawlers behind ChatGPT, Claude, Perplexity and Google AI Overviews fetch and quote the page?',
    checks: ['robots.txt rules for 23 AI and search crawlers, scored per AI product', 'Firewall and CDN probes as AI crawlers', 'noindex, nosnippet and noai directives'],
  },
  {
    name: 'AI-readable content',
    weight: 25,
    blurb: 'Is the content in the HTML without JavaScript, with a clear outline and a named source?',
    checks: ['Text in the initial HTML (no empty app shell)', 'One H1, heading outline, alt text, lang', 'Dates and author / publisher'],
  },
  {
    name: 'Structured data',
    weight: 20,
    blurb: 'Does JSON-LD state who is behind the site and what the page is?',
    checks: ['JSON-LD present and valid', 'Organization, Person, WebSite, Article, Product, FAQPage ...', 'Key fields per type'],
  },
  {
    name: 'SEO basics',
    weight: 25,
    blurb: 'AI search is built on classic search indexes, so the basics still count.',
    checks: ['Status, HTTPS, redirects', 'Title, description, canonical, viewport', 'Open Graph, X card, sitemap'],
  },
  {
    name: 'Agent readiness',
    weight: null,
    blurb: 'Optional extras for AI agents and developer tools. Reported as "x of y passed", not scored.',
    checks: ['llms.txt (the rules Lighthouse checks) and llms-full.txt', 'Names on buttons, links and form fields', 'Declarative WebMCP tools on forms'],
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: 'GEO Audit',
      url: `${SITE_URL}/`,
      description: 'Free, open-source audit of how well a website can be found, read and cited by AI search and assistants.',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@id': `${AUTHOR_URL}/#person` },
      isAccessibleForFree: true,
      sameAs: [REPO_URL],
    },
    { '@type': 'Person', '@id': `${AUTHOR_URL}/#person`, name: AUTHOR_NAME, url: AUTHOR_URL, jobTitle: 'Freelance web developer' },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'GEO Audit', url: `${SITE_URL}/`, publisher: { '@id': `${AUTHOR_URL}/#person` } },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="size-1.5 rounded-full bg-pass" aria-hidden />
            Free and open source · no sign-up
          </p>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Can AI assistants find, read and cite your site?
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            Enter a URL and get a GEO score with concrete fixes for ChatGPT, Claude, Perplexity and Google AI Overviews: crawler access,
            firewall blocks, server-rendered content, structured data and SEO basics.
          </p>
          <div className="mt-8 flex w-full justify-center">
            <UrlForm />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">Try:</span>
            {EXAMPLES.map((e) => (
              <Link
                key={e}
                href={reportHref(`https://${e}`)}
                className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground transition hover:border-ring/50 hover:text-foreground"
              >
                {e}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="checks" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-12 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What it checks</h2>
          <p className="mt-2 text-muted-foreground">
            26 checks in four weighted categories, plus 4 agent readiness checks that are reported but not scored. Every failed check
            comes with why it matters and a fix you can paste, filled in with your site&apos;s own values.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <div key={c.name} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-semibold">{c.name}</h3>
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{c.weight === null ? 'not scored' : `${c.weight}%`}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.blurb}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {c.checks.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="cli" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Run it from your terminal</h2>
            <p className="mt-2 text-muted-foreground">
              Same checks, same score. Add <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">--min-score 80</code> to
              fail a CI build when a deploy hurts your AI visibility, or <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">--json</code> for
              scripts.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-code px-4 py-3 font-mono text-sm">
            <span className="truncate">
              <span className="select-none text-muted-foreground">$ </span>npx ai-geo-audit example.com
            </span>
            <CopyButton text="npx ai-geo-audit example.com" className="shrink-0 px-2 py-1" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 text-sm text-muted-foreground md:grid-cols-3">
          <div>
            <h3 className="mb-1 font-medium text-foreground">How scoring works</h3>
            Each check earns 0–100% of its weight; categories are weighted 30 / 25 / 20 / 25 into one score. If major AI products are
            blocked, the score is capped: 89 for one, 79 for two, 69 for three or four, 54 for five or six. An app shell with no text
            in the HTML is capped at 69. A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 55.
          </div>
          <div>
            <h3 className="mb-1 font-medium text-foreground">Privacy</h3>
            We fetch the page you enter plus robots.txt, llms.txt, llms-full.txt and the sitemap, and the page again up to 4 times as AI
            crawlers to spot firewall blocks. Results live in memory for 10 minutes for shared links, then they are gone. No accounts, no
            tracking.
          </div>
          <div>
            <h3 className="mb-1 font-medium text-foreground">Polite crawling</h3>
            Requests identify as <code className="font-mono text-xs">GEO-Audit</code>. The up to 4 probe requests use the AI
            crawler&apos;s documented user agent with <code className="font-mono text-xs">GEO-Audit-probe</code> added, so they are easy
            to find in logs. Nothing runs your JavaScript, requests stop at 2 MB and 8 s, and only public addresses are reached.
          </div>
        </div>
      </section>
    </>
  );
}
