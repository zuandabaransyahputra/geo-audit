import { AI_BOTS, type Bot } from './bots';
import { ASTRO_GEO_URL } from './constants';
import { firstMeta, type PageModel } from './html';
import { extractJsonLd, missingFields, nameOf, textValue, ENTITY_TYPES, USEFUL_TYPES, type JsonLdExtraction } from './jsonld';
import { looksLikeHtml, validateLlmsTxt } from './llms';
import { isAllowed, parseRobots, type ParsedRobots } from './robots';
import type { AuditInputs, CategoryId, CheckResult, Status } from './types';

export interface CheckContext {
  inputs: AuditInputs;
  page: PageModel;
  html: string;
  url: URL;
  robots: ParsedRobots | null;
  robotsState: 'ok' | 'missing' | 'html' | 'error' | 'server-error';
  jsonld: JsonLdExtraction;
  siteName: string;
  description?: string;
}

type Spec = Omit<CheckResult, 'status' | 'score' | 'summary'>;

function result(spec: Spec, status: Status, summary: string, extra: Partial<CheckResult> = {}, score?: number): CheckResult {
  const s = score ?? (status === 'pass' || status === 'info' ? 1 : status === 'warn' ? 0.5 : 0);
  return { ...spec, status, summary, score: Math.max(0, Math.min(1, s)), ...extra };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------------------------------------ */
/* AI access                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

export function botVerdicts(ctx: CheckContext, bots: Bot[]) {
  const path = ctx.url.pathname + ctx.url.search;
  return bots.map((bot) => {
    if (ctx.robotsState === 'server-error' || ctx.robotsState === 'error') {
      return { bot, allowed: false, reason: 'robots.txt could not be fetched, so careful crawlers stay away' };
    }
    if (!ctx.robots) return { bot, allowed: true, reason: '' };
    const v = isAllowed(ctx.robots, bot.token, path);
    const group = v.matchedAgent === '*' ? 'User-agent: *' : `User-agent: ${bot.token}`;
    const reason = v.rule ? `\`${v.rule.allow ? 'Allow' : 'Disallow'}: ${v.rule.pattern}\` (line ${v.rule.line}, ${group})` : '';
    return { bot, allowed: v.allowed, reason };
  });
}

function robotsAllowSnippet(ctx: CheckContext, bots: Bot[]): string {
  const sitemap = ctx.robots?.sitemaps[0] ?? `${ctx.url.origin}/sitemap.xml`;
  return [...bots.map((b) => `User-agent: ${b.token}`), 'Allow: /', '', `Sitemap: ${sitemap}`].join('\n');
}

function checkAiSearchBots(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'ai-search-bots',
    category: 'ai-access',
    title: 'AI search and assistant crawlers can reach the page',
    weight: 5,
    why: 'ChatGPT, Claude, Perplexity and Google AI Overviews can only cite pages their crawlers are allowed to fetch.',
  };
  const bots = AI_BOTS.filter((b) => b.purpose !== 'training');
  const verdicts = botVerdicts(ctx, bots);
  const blocked = verdicts.filter((v) => !v.allowed);
  const details = verdicts.map((v) => `${v.allowed ? 'allowed' : 'BLOCKED'}  ${v.bot.token} (${v.bot.role})${!v.allowed && v.reason ? `: ${v.reason}` : ''}`);
  if (!blocked.length) {
    return result(spec, 'pass', `All ${bots.length} search and assistant crawlers are allowed${ctx.robots ? '' : ' (no robots.txt rules apply)'}.`, { details });
  }
  const score = 1 - blocked.length / bots.length;
  const core = blocked.some((v) => v.bot.token === 'Googlebot' || v.bot.token === 'Bingbot');
  const status: Status = core || score < 0.5 ? 'fail' : 'warn';
  return result(
    spec,
    status,
    `${plural(blocked.length, 'crawler')} blocked: ${blocked.map((v) => v.bot.token).join(', ')}.`,
    {
      details,
      fix: {
        text:
          ctx.robotsState === 'server-error' || ctx.robotsState === 'error'
            ? 'Make /robots.txt return 200 (or 404 if you have no rules). A 5xx or timeout makes crawlers treat the whole site as off limits.'
            : 'Remove the Disallow rules that match these crawlers, or give them their own group that allows the site:',
        snippet: robotsAllowSnippet(ctx, blocked.map((v) => v.bot)),
        lang: 'txt',
      },
    },
    score,
  );
}

function checkAiTrainingBots(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'ai-training-bots',
    category: 'ai-access',
    title: 'AI training crawlers',
    weight: 1,
    why: 'Training crawlers decide whether models learn about you at all; blocking them is a valid choice, but it makes you less known to assistants.',
  };
  const bots = AI_BOTS.filter((b) => b.purpose === 'training');
  const verdicts = botVerdicts(ctx, bots);
  const blocked = verdicts.filter((v) => !v.allowed);
  const details = verdicts.map((v) => `${v.allowed ? 'allowed' : 'blocked'}  ${v.bot.token} (${v.bot.role})${!v.allowed && v.reason ? `: ${v.reason}` : ''}`);
  if (!blocked.length) return result(spec, 'pass', `All ${bots.length} training crawlers are allowed.`, { details });
  return result(
    spec,
    'warn',
    `${blocked.length} of ${bots.length} training crawlers are blocked: ${blocked.map((v) => v.bot.token).join(', ')}. Fine if that is deliberate.`,
    {
      details,
      fix: {
        text: 'If you want models to know your brand and content, allow these crawlers. Keep them blocked if you opted out on purpose.',
        snippet: robotsAllowSnippet(ctx, blocked.map((v) => v.bot)),
        lang: 'txt',
      },
    },
    1 - blocked.length / bots.length,
  );
}

function checkRobotsTxt(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'robots-txt',
    category: 'ai-access',
    title: 'robots.txt is present and valid',
    weight: 1,
    why: 'robots.txt is the first file every crawler reads; it sets the rules and points to your sitemap.',
  };
  const sample = [`User-agent: *`, `Allow: /`, ``, `Sitemap: ${ctx.url.origin}/sitemap.xml`].join('\n');
  switch (ctx.robotsState) {
    case 'missing':
      return result(spec, 'warn', 'No robots.txt (404). Everything is allowed, but crawlers get no sitemap hint.', {
        fix: { text: `Add ${ctx.url.origin}/robots.txt:`, snippet: sample, lang: 'txt' },
      });
    case 'html':
      return result(spec, 'warn', '/robots.txt returns an HTML page instead of a text file.', {
        fix: { text: 'Serve a plain-text robots.txt from the site root (SPA fallbacks often answer every path with index.html).', snippet: sample, lang: 'txt' },
      });
    case 'server-error':
    case 'error': {
      const err = ctx.inputs.robots.ok ? `HTTP ${ctx.inputs.robots.res.status}` : ctx.inputs.robots.error;
      return result(spec, 'fail', `robots.txt could not be fetched (${err}). Crawlers treat that as "keep out".`, {
        fix: { text: 'Make /robots.txt return 200 with your rules, or 404 if you have none.', snippet: sample, lang: 'txt' },
      });
    }
    default: {
      const r = ctx.robots!;
      const groups = r.groups.length;
      if (r.invalidLines.length) {
        return result(spec, 'warn', `robots.txt parses with ${plural(r.invalidLines.length, 'unrecognised line')} (line ${r.invalidLines.slice(0, 5).join(', ')}).`, {
          fix: { text: 'Every line should be `Field: value` (User-agent, Allow, Disallow, Sitemap), and rules must come after a User-agent line.' },
        });
      }
      return result(spec, 'pass', `robots.txt found: ${plural(groups, 'group')}, ${plural(r.sitemaps.length, 'sitemap')} referenced.`);
    }
  }
}

export function directivesFor(ctx: CheckContext): { source: string; directives: string[] }[] {
  const out: { source: string; directives: string[] }[] = [];
  const split = (s: string) => s.toLowerCase().split(/\s*,\s*/).map((d) => d.trim()).filter(Boolean);
  const names = ['robots', 'googlebot', 'bingbot', ...AI_BOTS.map((b) => b.token.toLowerCase())];
  for (const n of names) {
    for (const c of ctx.page.meta.get(n) ?? []) out.push({ source: `<meta name="${n}">`, directives: split(c) });
  }
  const header = ctx.inputs.page.headers['x-robots-tag'];
  if (header) {
    // "googlebot: noindex, nofollow, otherbot: noarchive" or plain "noindex"
    let agent = '*';
    const buckets = new Map<string, string[]>();
    for (const part of header.split(',')) {
      const p = part.trim();
      const m = /^([a-z0-9_-]+)\s*:\s*(.*)$/i.exec(p);
      if (m && !/^(max-snippet|max-image-preview|max-video-preview|unavailable_after)$/i.test(m[1]!)) {
        agent = m[1]!.toLowerCase();
        if (m[2]) buckets.set(agent, [...(buckets.get(agent) ?? []), m[2].toLowerCase()]);
      } else if (p) buckets.set(agent, [...(buckets.get(agent) ?? []), p.toLowerCase()]);
    }
    for (const [a, d] of buckets) out.push({ source: `X-Robots-Tag${a === '*' ? '' : ` (${a})`}`, directives: d });
  }
  return out;
}

function checkIndexing(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'indexing-directives',
    category: 'ai-access',
    title: 'Page may be indexed and quoted',
    weight: 4,
    why: 'A noindex or nosnippet directive keeps the page out of search and AI answers even when crawling is allowed.',
  };
  const found = directivesFor(ctx);
  const hard: string[] = [];
  const soft: string[] = [];
  for (const { source, directives } of found) {
    for (const d of directives) {
      if (d === 'noindex' || d === 'none') hard.push(`${d} in ${source}`);
      else if (d === 'nosnippet' || d === 'max-snippet:0' || d === 'noai' || d === 'noimageai') soft.push(`${d} in ${source}`);
    }
  }
  if (hard.length) {
    return result(spec, 'fail', `The page is marked ${hard.join('; ')}.`, {
      fix: {
        text: 'Remove noindex from pages you want found. If it comes from a header, check your server or CDN config.',
        snippet: '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
        lang: 'html',
      },
    });
  }
  if (soft.length) {
    return result(spec, 'warn', `Limits on quoting: ${soft.join('; ')}.`, {
      fix: {
        text: 'nosnippet and max-snippet:0 stop Google from quoting the page, including in AI Overviews; noai is a non-standard opt-out. Drop them unless you mean it.',
        snippet: '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
        lang: 'html',
      },
    });
  }
  return result(spec, 'pass', found.length ? 'Robots directives allow indexing and snippets.' : 'No noindex or nosnippet directives.');
}

function checkLlmsTxt(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'llms-txt',
    category: 'ai-access',
    title: 'llms.txt is present and well formed',
    weight: 2,
    why: 'llms.txt gives assistants a short, curated Markdown map of your site instead of making them guess from navigation.',
  };
  const astro = ctx.page.isAstro
    ? ` On Astro, [astro-geo](${ASTRO_GEO_URL}) generates llms.txt and llms-full.txt from your pages at build time.`
    : '';
  const sample = [
    `# ${ctx.siteName}`,
    '',
    `> ${ctx.description ?? `One or two sentences on what ${ctx.siteName} is and who it is for.`}`,
    '',
    '## Pages',
    '',
    `- [Home](${ctx.url.origin}/): What you do, in one line`,
    `- [About](${ctx.url.origin}/about): Who is behind it`,
    `- [Contact](${ctx.url.origin}/contact): How to reach you`,
    '',
    '## Optional',
    '',
    `- [Blog](${ctx.url.origin}/blog): Articles and updates`,
  ].join('\n');
  const fix = { text: `Add ${ctx.url.origin}/llms.txt, a plain-text Markdown file.${astro} A starting point:`, snippet: sample, lang: 'md' };
  const f = ctx.inputs.llms;
  if (!f.ok) return result(spec, 'fail', `llms.txt could not be fetched (${f.error}).`, { fix });
  if (f.res.status !== 200) return result(spec, 'fail', `No llms.txt (HTTP ${f.res.status}).`, { fix });
  if (!f.res.body.trim()) return result(spec, 'fail', 'llms.txt is empty or not served as text.', { fix });
  const v = validateLlmsTxt(f.res.body);
  if (looksLikeHtml(f.res.body)) return result(spec, 'fail', '/llms.txt returns an HTML page, not a Markdown file.', { fix });
  if (!v.valid) return result(spec, 'warn', `llms.txt found but invalid: ${v.errors.join(' ')}`, { details: [...v.warnings, ...v.notes], fix }, 0.4);
  if (v.warnings.length) {
    return result(
      spec,
      'warn',
      `llms.txt found ("${v.title}", ${plural(v.sections.length, 'section')}, ${plural(v.linkCount, 'link')}) with ${plural(v.warnings.length, 'issue')}.`,
      { details: [...v.warnings, ...v.notes], fix: { text: `Tidy it up so it follows the llmstxt.org format.${astro} The expected shape:`, snippet: sample, lang: 'md' } },
      v.linkCount ? 0.8 : 0.6,
    );
  }
  return result(spec, 'pass', `llms.txt found: "${v.title}", ${plural(v.sections.length, 'section')}, ${plural(v.linkCount, 'link')}.`, v.notes.length ? { details: v.notes } : {});
}

function checkLlmsFull(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'llms-full-txt',
    category: 'ai-access',
    title: 'llms-full.txt is available',
    weight: 1,
    why: 'llms-full.txt hands assistants your key content in one clean Markdown file, so they quote you accurately.',
  };
  const fix = {
    text: ctx.page.isAstro
      ? `Publish ${ctx.url.origin}/llms-full.txt with the readable text of your main pages. [astro-geo](${ASTRO_GEO_URL}) can generate it (\`llms: { full: true }\`).`
      : `Publish ${ctx.url.origin}/llms-full.txt with the readable text of your main pages as Markdown (most docs tools and static site generators can export this).`,
  };
  const f = ctx.inputs.llmsFull;
  if (!f.ok) return result(spec, 'warn', `llms-full.txt could not be fetched (${f.error}).`, { fix }, 0);
  if (f.res.status !== 200 || !f.res.body.trim() || looksLikeHtml(f.res.body)) {
    return result(spec, 'warn', f.res.status === 200 ? '/llms-full.txt is not a Markdown file.' : `No llms-full.txt (HTTP ${f.res.status}).`, { fix }, 0);
  }
  const kb = Math.round(Buffer.byteLength(f.res.body) / 1024);
  return result(spec, 'pass', `llms-full.txt found (${f.res.truncated ? 'over ' : ''}${kb} KB).`);
}

/* ------------------------------------------------------------------------------------------------ */
/* AI-readable content                                                                              */
/* ------------------------------------------------------------------------------------------------ */

function checkServerText(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'server-rendered-text',
    category: 'content',
    title: 'Content is readable without JavaScript',
    weight: 4,
    why: 'Most AI crawlers do not run JavaScript; if the text only appears after hydration, they see an empty page.',
  };
  const { wordCount, appShell, noscriptSaysEnableJs } = ctx.page;
  const fix = {
    text: 'Render the main content on the server or at build time (SSR/SSG: Next.js, Astro, Nuxt, SvelteKit, or prerendering) so it is in the initial HTML.',
  };
  if (appShell || (noscriptSaysEnableJs && wordCount < 150)) {
    return result(spec, 'fail', `Looks like a client-side app shell: only ${plural(wordCount, 'word')} in the initial HTML.`, { fix });
  }
  if (wordCount < 50) return result(spec, 'fail', `Only ${plural(wordCount, 'word')} of text in the initial HTML.`, { fix });
  if (wordCount < 150) return result(spec, 'warn', `${wordCount} words of text in the initial HTML; thin for an assistant to quote.`, { fix: { text: 'Add a few clear paragraphs that say what the page offers, for whom, and why, in plain words.' } });
  return result(spec, 'pass', `${wordCount.toLocaleString('en-US')} words of text in the initial HTML.`);
}

function checkH1(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'single-h1',
    category: 'content',
    title: 'One clear H1',
    weight: 2,
    why: 'The H1 is the strongest hint of what the page is about, for search engines and language models alike.',
  };
  const h1s = ctx.page.headings.filter((h) => h.level === 1);
  const fix = { text: 'Use exactly one `<h1>` that names the page topic; use `<h2>`–`<h3>` for sections.', snippet: `<h1>${escapeHtml(ctx.page.title?.split(/\s[|–—-]\s/)[0] ?? ctx.siteName)}</h1>`, lang: 'html' };
  if (!h1s.length) return result(spec, 'fail', 'No `<h1>` in the initial HTML.', { fix });
  if (h1s.length > 1) return result(spec, 'warn', `${h1s.length} H1s: ${h1s.slice(0, 3).map((h) => `"${truncate(h.text, 40)}"`).join(', ')}.`, { fix });
  if (!h1s[0]!.text) return result(spec, 'warn', 'The H1 is empty (or only an image without alt text).', { fix });
  return result(spec, 'pass', `H1: "${truncate(h1s[0]!.text, 80)}".`);
}

function checkHeadingOrder(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'heading-order',
    category: 'content',
    title: 'Headings form an outline',
    weight: 1,
    why: 'A clean heading outline lets assistants split the page into sections and quote the right one.',
  };
  const hs = ctx.page.headings;
  if (hs.length < 2) {
    return result(spec, 'warn', `Only ${plural(hs.length, 'heading')}; there is no outline to follow.`, { fix: { text: 'Break the content into sections with `<h2>` headings that read like questions or topics.' } });
  }
  const skips: string[] = [];
  for (let i = 1; i < hs.length; i++) {
    if (hs[i]!.level > hs[i - 1]!.level + 1) skips.push(`h${hs[i - 1]!.level} → h${hs[i]!.level} ("${truncate(hs[i]!.text, 40)}")`);
  }
  if (skips.length) {
    return result(spec, 'warn', `${plural(skips.length, 'skipped heading level')} in ${hs.length} headings.`, {
      details: skips.slice(0, 8),
      fix: { text: 'Do not skip levels (h2 → h4). Style headings with CSS instead of picking a level for its size.' },
    }, Math.max(0.3, 1 - skips.length / hs.length));
  }
  return result(spec, 'pass', `${hs.length} headings in a consistent outline.`);
}

function checkImgAlt(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'img-alt',
    category: 'content',
    title: 'Images have alt text',
    weight: 1,
    why: 'Alt text is the only way text-only crawlers and models know what an image shows.',
  };
  const imgs = ctx.page.images;
  if (!imgs.length) return result(spec, 'pass', 'No `<img>` elements in the initial HTML.');
  const missing = imgs.filter((i) => i.alt === null).length;
  const described = imgs.filter((i) => i.alt !== null).length;
  const ratio = described / imgs.length;
  const summary = `${described} of ${imgs.length} images have an alt attribute (${pct(ratio)}).`;
  if (!missing) return result(spec, 'pass', summary);
  const fix = { text: 'Describe meaningful images; use `alt=""` for purely decorative ones.', snippet: '<img src="/team.jpg" alt="The five-person design team in the Lisbon studio">', lang: 'html' };
  return result(spec, ratio >= 0.8 ? 'warn' : 'fail', summary, { fix }, ratio);
}

function checkLang(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'lang',
    category: 'content',
    title: 'Language is declared',
    weight: 1,
    why: 'The `lang` attribute tells crawlers and models which language the page is in, which matters for multilingual answers.',
  };
  const lang = ctx.page.lang;
  const fix = { text: 'Set the language on the root element.', snippet: '<html lang="en">', lang: 'html' };
  if (!lang) return result(spec, 'fail', 'No `lang` attribute on `<html>`.', { fix });
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(lang)) return result(spec, 'warn', `\`lang="${lang}"\` is not a valid BCP 47 tag.`, { fix });
  return result(spec, 'pass', `\`<html lang="${lang}">\`.`);
}

function collectDates(ctx: CheckContext): { label: string; date: Date }[] {
  const out: { label: string; date: Date }[] = [];
  const add = (label: string, v: unknown) => {
    const s = textValue(v);
    if (!s) return;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) out.push({ label, date: d });
  };
  for (const n of ctx.jsonld.nodes) {
    add(`dateModified (${n.types[0]})`, n.data.dateModified);
    add(`datePublished (${n.types[0]})`, n.data.datePublished);
  }
  for (const k of ['article:modified_time', 'article:published_time', 'og:updated_time', 'last-modified', 'date']) {
    for (const v of ctx.page.meta.get(k) ?? []) add(`<meta ${k}>`, v);
  }
  return out;
}

function checkFreshness(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'freshness',
    category: 'content',
    title: 'Freshness signals',
    weight: 1,
    why: 'Assistants prefer sources that show when they were published or last updated, especially for time-sensitive questions.',
  };
  const dates = collectDates(ctx);
  const fix = {
    text: 'Show a visible "Updated" date and mirror it in JSON-LD (`datePublished`, `dateModified`).',
    snippet: `<time datetime="${new Date().toISOString().slice(0, 10)}">Updated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>`,
    lang: 'html',
  };
  if (dates.length) {
    const latest = dates.reduce((a, b) => (b.date > a.date ? b : a));
    const ageDays = (Date.now() - latest.date.getTime()) / 86_400_000;
    const when = latest.date.toISOString().slice(0, 10);
    if (ageDays > 730) return result(spec, 'warn', `Latest date is ${when} (${latest.label}), over two years old.`, { fix: { text: 'Review and update the content, then bump `dateModified`.' } }, 0.6);
    return result(spec, 'pass', `Dated ${when} (${latest.label})${ctx.page.timeElements ? `, plus ${plural(ctx.page.timeElements, '<time> element')}` : ''}.`);
  }
  if (ctx.page.timeElements) return result(spec, 'pass', `${plural(ctx.page.timeElements, '<time datetime> element')} on the page.`);
  if (ctx.inputs.page.headers['last-modified']) {
    return result(spec, 'warn', 'Only an HTTP Last-Modified header; no date in the page or its structured data.', { fix });
  }
  return result(spec, 'warn', 'No publish or update date found in the page or its structured data.', { fix }, 0);
}

function checkAuthorship(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'authorship',
    category: 'content',
    title: 'Author or publisher is identified',
    weight: 1,
    why: 'Named, verifiable authors and publishers make content more trustworthy to cite (E-E-A-T).',
  };
  const signals: string[] = [];
  const author = ctx.jsonld.nodes.map((n) => nameOf(n.data.author, ctx.jsonld)).find(Boolean);
  if (author) signals.push(`JSON-LD author "${truncate(author, 40)}"`);
  const publisher = ctx.jsonld.nodes.map((n) => nameOf(n.data.publisher, ctx.jsonld)).find(Boolean);
  if (publisher) signals.push(`JSON-LD publisher "${truncate(publisher, 40)}"`);
  const entity = ctx.jsonld.nodes.find((n) => n.types.some((t) => ENTITY_TYPES.includes(t)) && textValue(n.data.name));
  if (entity && !author) signals.push(`${entity.types[0]} "${truncate(textValue(entity.data.name)!, 40)}" in JSON-LD`);
  const metaAuthor = firstMeta(ctx.page, 'author', 'article:author');
  if (metaAuthor) signals.push(`<meta name="author" content="${truncate(metaAuthor, 40)}">`);
  if (ctx.page.links.has('author') || /<a\b[^>]*\brel=["'][^"']*\bauthor\b/i.test(ctx.html)) signals.push('rel="author" link');
  if (signals.length) return result(spec, 'pass', `Found: ${signals.join(', ')}.`);
  return result(spec, 'warn', 'No author, publisher or organisation is named in the markup.', {
    fix: { text: 'Name who is behind the content: a visible byline plus `author` in JSON-LD (see the Structured data fixes) and a meta tag.', snippet: `<meta name="author" content="${escapeHtml(ctx.siteName)}">`, lang: 'html' },
  }, 0);
}

/* ------------------------------------------------------------------------------------------------ */
/* Structured data                                                                                  */
/* ------------------------------------------------------------------------------------------------ */

function jsonLdSnippet(ctx: CheckContext): string {
  const origin = ctx.url.origin;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: ctx.siteName,
        url: `${origin}/`,
        logo: `${origin}/logo.png`,
        sameAs: ['https://www.linkedin.com/company/your-company', 'https://github.com/your-company'],
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: ctx.siteName,
        url: `${origin}/`,
        ...(ctx.description ? { description: ctx.description } : {}),
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>`;
}

function astroHint(ctx: CheckContext): string {
  return ctx.page.isAstro ? ` On Astro, [astro-geo](${ASTRO_GEO_URL}) gives you typed, injection-safe helpers for this graph.` : '';
}

function checkJsonLdPresent(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'jsonld-present',
    category: 'structured-data',
    title: 'JSON-LD structured data',
    weight: 3,
    why: 'JSON-LD states facts (who you are, what the page is) in a form search engines and assistants read without guessing.',
  };
  const { blocks, invalid, nodes } = ctx.jsonld;
  const fix = { text: `Add a JSON-LD graph to the \`<head>\` describing the site and who runs it (use Person instead of Organization for a personal site).${astroHint(ctx)}`, snippet: jsonLdSnippet(ctx), lang: 'html' };
  if (!blocks) return result(spec, 'fail', 'No `<script type="application/ld+json">` blocks.', { fix });
  if (invalid.length === blocks) {
    return result(spec, 'fail', `${plural(blocks, 'JSON-LD block')} found, none parse.`, { details: invalid.map((e) => `Block ${e.index + 1}: ${e.error}`), fix });
  }
  if (invalid.length) {
    return result(spec, 'warn', `${invalid.length} of ${blocks} JSON-LD blocks do not parse.`, {
      details: invalid.map((e) => `Block ${e.index + 1}: ${e.error}`),
      fix: { text: 'Fix the JSON syntax (trailing commas, unescaped quotes) and validate with validator.schema.org.' },
    }, 0.6);
  }
  return result(spec, 'pass', `${plural(blocks, 'JSON-LD block')} with ${plural(nodes.length, 'typed node')}.`);
}

function checkJsonLdTypes(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'jsonld-types',
    category: 'structured-data',
    title: 'Useful schema.org types',
    weight: 2,
    why: 'Types like Organization, Person, WebSite, Article, Product and FAQPage are the ones search features and assistants use.',
  };
  const types = [...new Set(ctx.jsonld.nodes.flatMap((n) => n.types))];
  const useful = types.filter((t) => USEFUL_TYPES.has(t));
  const hasEntity = types.some((t) => ENTITY_TYPES.includes(t));
  const fix = { text: `Describe who runs the site (Organization or Person) and what this page is (WebSite, WebPage, Article, Product, FAQPage, BreadcrumbList ...).${astroHint(ctx)}`, snippet: jsonLdSnippet(ctx), lang: 'html' };
  if (!types.length) {
    return result(spec, 'fail', 'No schema.org types found.', { fix: { text: 'Add the JSON-LD graph from the fix above; it covers Organization and WebSite.' } });
  }
  if (!useful.length) return result(spec, 'fail', `Only less useful types: ${types.join(', ')}.`, { fix });
  if (!hasEntity) return result(spec, 'warn', `Types: ${useful.join(', ')}. No Organization or Person says who is behind the site.`, { fix }, 0.6);
  if (useful.length < 2) return result(spec, 'warn', `Only ${useful[0]}; add what the page itself is (WebSite, WebPage, Article ...).`, { fix }, 0.7);
  return result(spec, 'pass', `Types: ${useful.join(', ')}.`);
}

function checkJsonLdFields(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'jsonld-fields',
    category: 'structured-data',
    title: 'Structured data has the key fields',
    weight: 2,
    why: 'Nodes missing required fields (name, url, headline, author, dates ...) are ignored for rich results and give models little to work with.',
  };
  const nodes = ctx.jsonld.nodes.filter((n) => n.types.some((t) => USEFUL_TYPES.has(t)));
  if (!nodes.length) return result(spec, 'fail', 'Nothing to check: no useful JSON-LD nodes.', { fix: { text: 'Add JSON-LD first (see above).' } });
  const problems = nodes.map((n) => ({ n, missing: missingFields(n) })).filter((p) => p.missing.length);
  if (!problems.length) return result(spec, 'pass', `All ${plural(nodes.length, 'node')} have their key fields.`);
  const score = 1 - problems.length / nodes.length;
  return result(spec, score >= 0.5 ? 'warn' : 'fail', `${problems.length} of ${plural(nodes.length, 'node')} miss key fields.`, {
    details: problems.slice(0, 10).map((p) => `${p.n.types.join('/')}${textValue(p.n.data.name) ? ` "${truncate(textValue(p.n.data.name)!, 30)}"` : ''}: missing ${p.missing.join(', ')}`),
    fix: { text: 'Fill in the missing properties; check the result with Google\'s Rich Results Test or validator.schema.org.' },
  }, score);
}

function checkOtherStructured(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'microdata-rdfa',
    category: 'structured-data',
    title: 'Microdata and RDFa',
    weight: 0,
    why: 'Microdata and RDFa still work, but JSON-LD is easier to maintain and is what Google recommends.',
  };
  const md = [...new Set(ctx.page.microdataTypes.map((t) => t.split(/\s+/).map((x) => x.replace(/^https?:\/\/schema\.org\//, '')).join(' ')))];
  const rdfa = [...new Set(ctx.page.rdfaTypes)];
  if (!md.length && !rdfa.length) return result(spec, 'info', 'No microdata or RDFa (fine; JSON-LD is preferred).');
  const parts = [md.length ? `microdata: ${md.slice(0, 6).join(', ')}` : '', rdfa.length ? `RDFa: ${rdfa.slice(0, 6).join(', ')}` : ''].filter(Boolean);
  return result(spec, 'info', `Also found ${parts.join('; ')}.`);
}

/* ------------------------------------------------------------------------------------------------ */
/* SEO basics                                                                                       */
/* ------------------------------------------------------------------------------------------------ */

function checkHttps(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'https', category: 'seo', title: 'Served over HTTPS', weight: 2, why: 'HTTPS is a ranking signal, and browsers and crawlers flag plain HTTP as unsafe.' };
  if (ctx.url.protocol === 'https:') {
    const upgraded = ctx.inputs.page.url.startsWith('http:') ? ' (HTTP redirects to HTTPS)' : '';
    return result(spec, 'pass', `The final URL uses HTTPS${upgraded}.`);
  }
  return result(spec, 'fail', 'The page is served over plain HTTP.', { fix: { text: 'Get a free certificate (Let\'s Encrypt, or your host\'s built-in TLS) and 301-redirect http:// to https://.' } });
}

function checkStatus(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'http-status', category: 'seo', title: 'Page returns 200', weight: 3, why: 'Crawlers only index pages that answer with a 2xx status.' };
  const s = ctx.inputs.page.status;
  if (s >= 200 && s < 300) return result(spec, 'pass', `HTTP ${s}.`);
  return result(spec, 'fail', `HTTP ${s}.`, { fix: { text: s === 403 || s === 429 || s === 503 ? 'The server refused an honest crawler. Check bot protection or firewall rules (Cloudflare, Vercel, WAF) so verified AI and search crawlers get through.' : 'Make the URL return 200, or 301-redirect it to the page that does.' } });
}

function checkRedirects(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'redirects', category: 'seo', title: 'Few redirects', weight: 1, why: 'Every redirect hop costs crawl budget and time; long chains may be abandoned.' };
  const r = ctx.inputs.page.redirects;
  const chain = [...r, ctx.inputs.page.finalUrl];
  if (r.length <= 1) return result(spec, 'pass', r.length ? `1 redirect: ${chain.join(' → ')}.` : 'No redirects.');
  return result(spec, r.length > 3 ? 'fail' : 'warn', `${r.length} redirects before the page loads.`, {
    details: chain,
    fix: { text: `Link to and redirect straight to the final URL (${ctx.inputs.page.finalUrl}) in one hop.` },
  });
}

function checkTitle(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'title', category: 'seo', title: 'Title tag', weight: 2, why: 'The title is the headline in search results and the label assistants use when they cite you.' };
  const t = ctx.page.title;
  const snippet = `<title>${escapeHtml(ctx.siteName)}: what you offer, for whom</title>`;
  if (!t) return result(spec, 'fail', 'No `<title>`.', { fix: { text: 'Add a unique, descriptive title of 30–60 characters.', snippet, lang: 'html' } });
  const len = [...t].length;
  if (len < 15) return result(spec, 'warn', `Title is short (${len} chars): "${t}".`, { fix: { text: 'Say what the page offers, not just the brand (30–60 characters).', snippet, lang: 'html' } });
  if (len > 65) return result(spec, 'warn', `Title is long (${len} chars) and will be cut off: "${truncate(t, 70)}".`, { fix: { text: 'Keep it under ~60 characters; put the important words first.' } }, 0.7);
  return result(spec, 'pass', `"${t}" (${len} chars).`);
}

function checkDescription(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'meta-description', category: 'seo', title: 'Meta description', weight: 2, why: 'The description is your pitch in search results and a ready-made summary for assistants.' };
  const d = firstMeta(ctx.page, 'description');
  const snippet = `<meta name="description" content="${escapeHtml(ctx.siteName)} helps [who] do [what]. [One concrete proof point or offer.]">`;
  if (!d) return result(spec, 'fail', 'No meta description.', { fix: { text: 'Add a 70–160 character summary of the page.', snippet, lang: 'html' } });
  const len = [...d].length;
  if (len < 50) return result(spec, 'warn', `Description is short (${len} chars).`, { fix: { text: 'Aim for 70–160 characters that say what the page offers and for whom.', snippet, lang: 'html' } }, 0.6);
  if (len > 170) return result(spec, 'warn', `Description is long (${len} chars) and will be truncated.`, { fix: { text: 'Trim it to ~160 characters; lead with the key point.' } }, 0.8);
  return result(spec, 'pass', `${len} chars: "${truncate(d, 100)}".`);
}

function checkCanonical(ctx: CheckContext): CheckResult {
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

function checkOpenGraph(ctx: CheckContext): CheckResult {
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

function checkTwitter(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'twitter-card', category: 'seo', title: 'Twitter / X card', weight: 0.5, why: 'A twitter:card tag gives X (and apps that read it) a large image preview instead of a bare link.' };
  const card = firstMeta(ctx.page, 'twitter:card');
  if (card) return result(spec, 'pass', `twitter:card = ${card}.`);
  return result(spec, 'warn', 'No twitter:card tag (X falls back to Open Graph, but shows a small preview).', {
    fix: { text: 'Add a large image card; X reuses og:title, og:description and og:image.', snippet: '<meta name="twitter:card" content="summary_large_image">', lang: 'html' },
  }, 0.4);
}

function checkSitemap(ctx: CheckContext): CheckResult {
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

function checkViewport(ctx: CheckContext): CheckResult {
  const spec: Spec = { id: 'viewport', category: 'seo', title: 'Mobile viewport', weight: 0.5, why: 'Google indexes the mobile version of pages; without a viewport tag the page renders as desktop on phones.' };
  if (ctx.page.hasViewport) return result(spec, 'pass', 'Viewport meta tag is set.');
  return result(spec, 'fail', 'No viewport meta tag.', { fix: { text: 'Add it to the `<head>`.', snippet: '<meta name="viewport" content="width=device-width, initial-scale=1">', lang: 'html' } });
}

/* ------------------------------------------------------------------------------------------------ */

export const CHECKS: Record<CategoryId, ((ctx: CheckContext) => CheckResult)[]> = {
  'ai-access': [checkAiSearchBots, checkIndexing, checkLlmsTxt, checkLlmsFull, checkRobotsTxt, checkAiTrainingBots],
  content: [checkServerText, checkH1, checkHeadingOrder, checkImgAlt, checkLang, checkFreshness, checkAuthorship],
  'structured-data': [checkJsonLdPresent, checkJsonLdTypes, checkJsonLdFields, checkOtherStructured],
  seo: [checkStatus, checkHttps, checkTitle, checkDescription, checkSitemap, checkCanonical, checkOpenGraph, checkRedirects, checkTwitter, checkViewport],
};

/** Build the shared context the checks read from. */
export function buildContext(inputs: AuditInputs, page: PageModel): CheckContext {
  const url = new URL(inputs.page.finalUrl);
  let robots: ParsedRobots | null = null;
  let robotsState: CheckContext['robotsState'] = 'missing';
  const r = inputs.robots;
  if (!r.ok) robotsState = 'error';
  else if (r.res.status >= 500) robotsState = 'server-error';
  else if (r.res.status >= 400) robotsState = 'missing';
  else if (r.res.status >= 200 && r.res.status < 300) {
    if (looksLikeHtml(r.res.body)) robotsState = 'html';
    else {
      robotsState = 'ok';
      robots = parseRobots(r.res.body);
    }
  }
  const jsonld = extractJsonLd(page.jsonLd);
  const website = jsonld.nodes.find((n) => n.types.includes('WebSite'));
  const entity = jsonld.nodes.find((n) => n.types.some((t) => ENTITY_TYPES.includes(t)));
  const siteName =
    firstMeta(page, 'og:site_name', 'application-name') ??
    textValue(website?.data.name) ??
    textValue(entity?.data.name) ??
    page.title?.split(/\s[|–—·:-]\s/).map((s) => s.trim()).filter(Boolean).sort((a, b) => a.length - b.length)[0] ??
    url.hostname.replace(/^www\./, '');
  const description = firstMeta(page, 'description', 'og:description');
  return { inputs, page, html: inputs.page.body, url, robots, robotsState, jsonld, siteName, description };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s: string, n: number): string {
  const chars = [...s];
  return chars.length > n ? `${chars.slice(0, n - 1).join('')}…` : s;
}
