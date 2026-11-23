import { buildContext, CHECKS } from './checks';
import { VERSION } from './constants';
import { FetchError, HTML_TYPES, safeFetch, TEXT_TYPES, XML_TYPES, type SafeFetchOptions } from './fetch';
import { parsePage } from './html';
import { buildInsights, LEARN_MORE } from './insights';
import { isAppShell } from './checks/content';
import { productStatuses } from './products';
import { CATEGORIES, categoryScore, gradeFor, overallScore, scoreCap, tally, type CapInput } from './score';
import { looksLikeHtml } from './llms';
import { PROBE_MAX_BYTES, PROBE_TIMEOUT_MS, probeTargets, type ProbeFetch } from './probe';
import { globalContentSignals, isAllowed, parseRobots } from './robots';
import { normalizeInputUrl } from './ssrf';
import type { AuditInputs, AuditRequestOptions, AuxFetch, CategoryResult, Fetched, Report } from './types';

export interface AuditOptions extends AuditRequestOptions {
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

function capInputFor(ctx: ReturnType<typeof buildContext>, categories: CategoryResult[]): CapInput {
  // Only a real app shell caps the score; a short page that is fully in the HTML is thin, not hidden.
  const shell = categories.flatMap((c) => c.checks).find((c) => c.id === 'server-rendered-text');
  return { products: productStatuses(ctx), appShell: shell?.status === 'fail' && isAppShell(ctx.page) };
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
    return { ...c, checks, score: categoryScore(checks), ...(c.weight === 0 ? { tally: tally(checks) } : {}) };
  });
  const rawScore = overallScore(categories);
  const capInput = capInputFor(ctx, categories);
  const found = scoreCap(capInput);
  const cap = found && found.limit < rawScore ? found : null;
  const score = cap ? cap.limit : rawScore;
  return {
    url: inputs.page.url,
    finalUrl: inputs.page.finalUrl,
    domain: ctx.url.hostname,
    fetchedAt: new Date().toISOString(),
    durationMs: meta.startedAt ? Date.now() - meta.startedAt : 0,
    score,
    rawScore,
    cap,
    grade: gradeFor(score),
    categories,
    page: { status: inputs.page.status, redirects: inputs.page.redirects, title: page.title, isAstro: page.isAstro },
    insights: buildInsights(ctx, ctx.url.hostname, categories, { score, rawScore, cap, capInput }),
    options: { trainingOptOut: ctx.trainingOptOut, trainingOptOutSource: ctx.trainingOptOutSource },
    probes: ctx.probes,
    contentSignals: ctx.robots?.contentSignals.length ? { global: globalContentSignals(ctx.robots), lines: ctx.robots.contentSignals } : null,
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

  const [sitemap, probes] = await Promise.all([findSitemap(fetcher, origin, robots, base), runProbes(fetcher, page, robots, base, Boolean(options.trainingOptOut))]);
  return analyze({ options: { trainingOptOut: Boolean(options.trainingOptOut) }, page, robots, llms, llmsFull, sitemap, probes }, { startedAt });
}

/**
 * Fetch the page again as up to four AI crawlers that robots.txt allows, through the same safe fetcher.
 * Skipped when the normal request did not get a 2xx (nothing to compare against). No retries.
 */
async function runProbes(
  fetcher: NonNullable<AuditOptions['fetcher']>,
  page: Fetched,
  robots: AuxFetch,
  base: SafeFetchOptions,
  optOut: boolean,
): Promise<ProbeFetch[]> {
  if (page.status < 200 || page.status >= 300) return [];
  // Same robots.txt reading as the checks: unreachable or 5xx = keep out, 4xx = allow all.
  if (!robots.ok || robots.res.status >= 500) return [];
  const parsed = robots.res.status >= 200 && robots.res.status < 300 && !looksLikeHtml(robots.res.body) ? parseRobots(robots.res.body) : null;
  const path = new URL(page.finalUrl);
  const allowed = (token: string) => !parsed || isAllowed(parsed, token, path.pathname + path.search).allowed;
  const signalled = parsed ? globalContentSignals(parsed)?.['ai-train'] === 'no' : false;
  const targets = probeTargets(allowed, optOut || signalled);
  const opts: SafeFetchOptions = { ...base, accept: HTML_TYPES, timeoutMs: PROBE_TIMEOUT_MS, maxBytes: PROBE_MAX_BYTES, truncate: true };
  return Promise.all(targets.map(async (t) => ({ token: t.bot.token, userAgent: t.userAgent, res: await aux(fetcher, page.finalUrl, { ...opts, userAgent: t.userAgent }) })));
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
