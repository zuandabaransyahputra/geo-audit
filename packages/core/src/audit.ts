import { buildContext, CHECKS } from './checks';
import { VERSION } from './constants';
import { FetchError, HTML_TYPES, safeFetch, TEXT_TYPES, XML_TYPES, type SafeFetchOptions } from './fetch';
import { parsePage } from './html';
import { buildInsights, LEARN_MORE } from './insights';
import { CATEGORIES, categoryScore, gradeFor, overallScore } from './score';
import { normalizeInputUrl } from './ssrf';
import type { AuditInputs, AuxFetch, CategoryResult, Fetched, Report } from './types';

export interface AuditOptions {
  fetchOptions?: SafeFetchOptions;
  /** Injected fetcher (tests). Defaults to `safeFetch`. */
  fetcher?: (url: string, opts: SafeFetchOptions) => Promise<Fetched>;
}

async function aux(fetcher: NonNullable<AuditOptions['fetcher']>, url: string, opts: SafeFetchOptions): Promise<AuxFetch> {
  try {
    return { ok: true, res: await fetcher(url, opts) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Run every check on already-fetched inputs. Pure: no network. */
export function analyze(inputs: AuditInputs, meta: { startedAt?: number } = {}): Report {
  const page = parsePage(inputs.page.body);
  const ctx = buildContext(inputs, page);
  const categories: CategoryResult[] = CATEGORIES.map((c) => {
    const checks = CHECKS[c.id].map((fn) => {
      const r = fn(ctx);
      return LEARN_MORE[r.id] ? { ...r, learnMore: LEARN_MORE[r.id] } : r;
    });
    return { ...c, checks, score: categoryScore(checks) };
  });
  const score = overallScore(categories);
  return {
    url: inputs.page.url,
    finalUrl: inputs.page.finalUrl,
    domain: ctx.url.hostname,
    fetchedAt: new Date().toISOString(),
    durationMs: meta.startedAt ? Date.now() - meta.startedAt : 0,
    score,
    grade: gradeFor(score),
    categories,
    page: { status: inputs.page.status, redirects: inputs.page.redirects, title: page.title, isAstro: page.isAstro },
    insights: buildInsights(ctx, ctx.url.hostname, categories),
    toolVersion: VERSION,
  };
}

/** Fetch a URL and its well-known files, then audit it. Throws BlockedUrlError / FetchError. */
export async function audit(input: string, options: AuditOptions = {}): Promise<Report> {
  const startedAt = Date.now();
  const fetcher = options.fetcher ?? safeFetch;
  const base = options.fetchOptions ?? {};
  const url = normalizeInputUrl(input);

  const page = await fetcher(url.href, { ...base, accept: HTML_TYPES });
  const type = (page.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (type && !HTML_TYPES.includes(type)) {
    throw new FetchError(`The URL returned ${type}, not an HTML page.`);
  }
  if (!page.body.trim()) {
    throw new FetchError(`The page returned HTTP ${page.status} with an empty body.`);
  }

  const origin = new URL(page.finalUrl).origin;
  const text = { ...base, accept: TEXT_TYPES, acceptHeader: 'text/plain,text/markdown;q=0.9,*/*;q=0.5' };
  const [robots, llms, llmsFull] = await Promise.all([
    aux(fetcher, `${origin}/robots.txt`, { ...text, maxBytes: 512 * 1024, truncate: true }),
    aux(fetcher, `${origin}/llms.txt`, { ...text, maxBytes: 1024 * 1024, truncate: true }),
    aux(fetcher, `${origin}/llms-full.txt`, { ...text, maxBytes: 64 * 1024, truncate: true }),
  ]);

  const sitemap = await findSitemap(fetcher, origin, robots, base);
  return analyze({ page, robots, llms, llmsFull, sitemap }, { startedAt });
}

async function findSitemap(
  fetcher: NonNullable<AuditOptions['fetcher']>,
  origin: string,
  robots: AuxFetch,
  base: SafeFetchOptions,
): Promise<AuditInputs['sitemap']> {
  const opts = { ...base, accept: XML_TYPES, acceptHeader: 'application/xml,text/xml;q=0.9,*/*;q=0.5', maxBytes: 1024 * 1024, truncate: true };
  const declared: string[] = [];
  if (robots.ok && robots.res.status === 200) {
    for (const m of robots.res.body.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)) declared.push(m[1]!);
  }
  if (declared[0]) {
    let u: string | null = null;
    try {
      u = new URL(declared[0], origin).href;
    } catch {
      u = null;
    }
    if (u) return { ...(await aux(fetcher, u, opts)), source: 'robots' };
  }
  let last: AuxFetch = { ok: false, error: 'not found' };
  for (const path of ['/sitemap.xml', '/sitemap-index.xml', '/sitemap_index.xml']) {
    const r = await aux(fetcher, origin + path, opts);
    if (r.ok && r.res.status === 200 && /<(urlset|sitemapindex)[\s>]/i.test(r.res.body)) return { ...r, source: 'default' };
    if (path === '/sitemap.xml') last = r;
  }
  return { ...last, source: 'default' };
}
