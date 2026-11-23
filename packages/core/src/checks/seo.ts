import { firstMeta } from '../html';
import type { CheckResult, Status } from '../types';
import { escapeHtml, plural, result, truncate, type CheckContext, type Spec } from './shared';

export function checkHttps(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'https', category: 'seo', title: 'Served over HTTPS', weight: 2, why: 'HTTPS is a ranking signal, and browsers and crawlers flag plain HTTP as unsafe.' };
  if (ctx.url.protocol === 'https:') {
    const upgraded = ctx.inputs.page.url.startsWith('http:') ? ' (HTTP redirects to HTTPS)' : '';
    return result(spec, 'pass', `The final URL uses HTTPS${upgraded}.`);
  }
  return result(spec, 'fail', 'The page is served over plain HTTP.', { fix: { text: 'Get a free certificate (Let\'s Encrypt, or your host\'s built-in TLS) and 301-redirect http:// to https://.' } });
}

export function checkStatus(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'http-status', category: 'seo', title: 'Page returns 200', weight: 3, why: 'Crawlers only index pages that answer with a 2xx status.' };
  const s = ctx.inputs.page.status;
  if (s >= 200 && s < 300) return result(spec, 'pass', `HTTP ${s}.`);
  return result(spec, 'fail', `HTTP ${s}.`, { fix: { text: s === 403 || s === 429 || s === 503 ? 'The server refused an honest crawler. Check bot protection or firewall rules (Cloudflare, Vercel, WAF) so verified AI and search crawlers get through.' : 'Make the URL return 200, or 301-redirect it to the page that does.' } });
}

export function checkRedirects(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'redirects', category: 'seo', title: 'Few redirects', weight: 1, why: 'Every redirect hop costs crawl budget and time; long chains may be abandoned.' };
  const r = ctx.inputs.page.redirects;
  const chain = [...r, ctx.inputs.page.finalUrl];
  if (r.length <= 1) return result(spec, 'pass', r.length ? `1 redirect: ${chain.join(' → ')}.` : 'No redirects.');
  return result(spec, r.length > 3 ? 'fail' : 'warn', `${r.length} redirects before the page loads.`, {
    details: chain,
    fix: { text: `Link to and redirect straight to the final URL (${ctx.inputs.page.finalUrl}) in one hop.` },
  });
}

export function checkTitle(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'title', category: 'seo', title: 'Title tag', weight: 2, why: 'The title is the headline in search results and the label assistants use when they cite you.' };
  const t = ctx.page.title;
  const snippet = `<title>${escapeHtml(ctx.siteName)}: what you offer, for whom</title>`;
  if (!t) return result(spec, 'fail', 'No `<title>`.', { fix: { text: 'Add a unique, descriptive title of 30–60 characters.', snippet, lang: 'html' } });
  const len = [...t].length;
  if (len < 15) return result(spec, 'warn', `Title is short (${len} chars): "${t}".`, { fix: { text: 'Say what the page offers, not just the brand (30–60 characters).', snippet, lang: 'html' } });
  if (len > 65) return result(spec, 'warn', `Title is long (${len} chars) and will be cut off: "${truncate(t, 70)}".`, { fix: { text: 'Keep it under ~60 characters; put the important words first.' } }, 0.7);
  return result(spec, 'pass', `"${t}" (${len} chars).`);
}

export function checkDescription(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'meta-description', category: 'seo', title: 'Meta description', weight: 2, why: 'The description is your pitch in search results and a ready-made summary for assistants.' };
  const d = firstMeta(ctx.page, 'description');
  const snippet = `<meta name="description" content="${escapeHtml(ctx.siteName)} helps [who] do [what]. [One concrete proof point or offer.]">`;
  if (!d) return result(spec, 'fail', 'No meta description.', { fix: { text: 'Add a 70–160 character summary of the page.', snippet, lang: 'html' } });
  const len = [...d].length;
  if (len < 50) return result(spec, 'warn', `Description is short (${len} chars).`, { fix: { text: 'Aim for 70–160 characters that say what the page offers and for whom.', snippet, lang: 'html' } }, 0.6);
  if (len > 170) return result(spec, 'warn', `Description is long (${len} chars) and will be truncated.`, { fix: { text: 'Trim it to ~160 characters; lead with the key point.' } }, 0.8);
  return result(spec, 'pass', `${len} chars: "${truncate(d, 100)}".`);
}

export function checkCanonical(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'canonical', category: 'seo', title: 'Canonical URL', weight: 1, why: 'A canonical link tells crawlers which URL to index and cite when the same page is reachable several ways.' };
  const href = ctx.page.links.get('canonical')?.[0];
  const snippet = `<link rel="canonical" href="${escapeHtml(ctx.url.href)}">`;
  if (!href) return result(spec, 'warn', 'No `<link rel="canonical">`.', { fix: { text: 'Add an absolute canonical URL to every page.', snippet, lang: 'html' } }, 0.3);
  let canon: URL;
  try {
    canon = new URL(href, ctx.url);
  } catch {
    return result(spec, 'fail', `Canonical "${href}" is not a valid URL.`, { fix: { text: 'Use an absolute URL.', snippet, lang: 'html' } });
  }
  const strip = (u: URL) => `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, '')}${u.search}`;
  if (strip(canon) !== strip(ctx.url)) {
    return result(spec, 'warn', `Canonical points elsewhere: ${canon.href}.`, { fix: { text: 'Fine for duplicates; otherwise point the canonical at this page itself.' } }, 0.6);
  }
  if (!/^https?:\/\//i.test(href)) return result(spec, 'warn', `Canonical is relative ("${href}").`, { fix: { text: 'Use an absolute URL.', snippet, lang: 'html' } }, 0.7);
  return result(spec, 'pass', `${canon.href}`);
}

export function checkOpenGraph(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'open-graph', category: 'seo', title: 'Open Graph tags', weight: 1, why: 'Open Graph controls how links to you look when they are shared, including in chat apps and assistants.' };
  const want = ['og:title', 'og:description', 'og:image', 'og:url'];
  const missing = want.filter((k) => !firstMeta(ctx.page, k));
  const snippet = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(ctx.page.title ?? ctx.siteName)}">`,
    `<meta property="og:description" content="${escapeHtml(ctx.description ?? 'One-sentence summary of the page.')}">`,
    `<meta property="og:url" content="${escapeHtml(ctx.url.href)}">`,
    `<meta property="og:image" content="${ctx.url.origin}/og.jpg">`,
  ].join('\n');
  if (!missing.length) return result(spec, 'pass', 'og:title, og:description, og:image and og:url are set.');
  const status: Status = missing.includes('og:title') || missing.includes('og:image') ? (missing.length >= 3 ? 'fail' : 'warn') : 'warn';
  return result(spec, status, `Missing ${missing.join(', ')}.`, { fix: { text: 'Add the missing tags (image: 1200×630).', snippet, lang: 'html' } }, 1 - missing.length / want.length);
}

export function checkTwitter(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'twitter-card', category: 'seo', title: 'Twitter / X card', weight: 0.5, why: 'A twitter:card tag gives X (and apps that read it) a large image preview instead of a bare link.' };
  const card = firstMeta(ctx.page, 'twitter:card');
  if (card) return result(spec, 'pass', `twitter:card = ${card}.`);
  return result(spec, 'warn', 'No twitter:card tag (X falls back to Open Graph, but shows a small preview).', {
    fix: { text: 'Add a large image card; X reuses og:title, og:description and og:image.', snippet: '<meta name="twitter:card" content="summary_large_image">', lang: 'html' },
  }, 0.4);
}

export function checkSitemap(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'sitemap', category: 'seo', title: 'XML sitemap', weight: 2, why: 'A sitemap lists every page you want found, so crawlers (and AI search indexes built on them) do not miss any.' };
  const s = ctx.inputs.sitemap;
  const inRobots = Boolean(ctx.robots?.sitemaps.length);
  const fix = { text: `Publish ${ctx.url.origin}/sitemap.xml (most frameworks have a plugin) and reference it in robots.txt.`, snippet: `Sitemap: ${ctx.url.origin}/sitemap.xml`, lang: 'txt' };
  if (!s.ok || s.res.status !== 200) {
    const why = s.ok ? `HTTP ${s.res.status}` : s.error;
    return result(spec, 'fail', inRobots ? `robots.txt points to a sitemap that does not load (${why}).` : 'No sitemap found in robots.txt or at /sitemap.xml.', { fix });
  }
  const body = s.res.body;
  const kind = /<sitemapindex[\s>]/i.test(body) ? 'sitemap index' : /<urlset[\s>]/i.test(body) ? 'sitemap' : null;
  if (!kind) return result(spec, 'warn', `${s.res.finalUrl} does not look like an XML sitemap.`, { fix }, 0.3);
  const count = (body.match(/<loc>/gi) ?? []).length;
  const summary = `${kind} at ${s.res.finalUrl} (${plural(count, kind === 'sitemap index' ? 'child sitemap' : 'URL')}).`;
  if (!inRobots) {
    return result(spec, 'warn', `${summary.replace(/\.$/, '')}, but robots.txt does not reference it.`, { fix: { text: 'Add a Sitemap line to robots.txt:', snippet: `Sitemap: ${s.res.finalUrl}`, lang: 'txt' } }, 0.75);
  }
  return result(spec, 'pass', `${summary.replace(/\.$/, '')}, referenced in robots.txt.`);
}

export function checkViewport(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'viewport', category: 'seo', title: 'Mobile viewport', weight: 0.5, why: 'Google indexes the mobile version of pages; without a viewport tag the page renders as desktop on phones.' };
  if (ctx.page.hasViewport) return result(spec, 'pass', 'Viewport meta tag is set.');
  return result(spec, 'fail', 'No viewport meta tag.', { fix: { text: 'Add it to the `<head>`.', snippet: '<meta name="viewport" content="width=device-width, initial-scale=1">', lang: 'html' } });
}
