import { describe, expect, it } from 'vitest';
import { analyze, audit } from '../src/audit';
import { countWords, parsePage } from '../src/html';
import { toMarkdown } from '../src/markdown';
import { categoryScore, gradeFor, overallScore, topFixes } from '../src/score';
import type { CheckResult, Fetched, Report } from '../src/types';
import { fetched, GOOD_HTML, inputs, LLMS, ROBOTS, SITEMAP } from './fixtures';

const check = (r: Report, id: string) => r.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;

describe('scoring', () => {
  const c = (weight: number, score: number): CheckResult => ({ id: 'x', category: 'seo', title: 't', status: 'pass', weight, score, summary: '', why: '' });

  it('weights checks inside a category and ignores informational ones', () => {
    expect(categoryScore([c(3, 1), c(1, 0)])).toBe(75);
    expect(categoryScore([c(1, 1), c(0, 0)])).toBe(100);
    expect(categoryScore([])).toBe(100);
  });

  it('weights categories in the overall score', () => {
    expect(overallScore([{ weight: 0.3, score: 100 }, { weight: 0.7, score: 50 }])).toBe(65);
  });

  it('maps scores to grades', () => {
    expect([100, 90, 89, 80, 70, 55, 54, 0].map(gradeFor)).toEqual(['A', 'A', 'B', 'B', 'C', 'D', 'F', 'F']);
  });

  it('documented category weights add up to 100%', () => {
    const r = analyze(inputs());
    expect(r.categories.reduce((n, x) => n + x.weight, 0)).toBeCloseTo(1);
    expect(r.categories.map((x) => [x.id, x.weight])).toEqual([
      ['ai-access', 0.3],
      ['content', 0.25],
      ['structured-data', 0.2],
      ['seo', 0.25],
    ]);
  });
});

describe('analyze', () => {
  it('gives a well-built site an A', () => {
    const r = analyze(inputs());
    const notPassing = r.categories.flatMap((x) => x.checks).filter((x) => x.status !== 'pass' && x.status !== 'info');
    expect(notPassing.map((x) => `${x.id}: ${x.summary}`)).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
    expect(topFixes(r.categories)).toEqual([]);
  });

  it('fails an empty client-side app shell', () => {
    const html = '<!doctype html><html><head><title>App</title></head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript><script src="/main.js"></script></body></html>';
    const r = analyze(inputs({ page: fetched('https://acme.dev/', html) }));
    expect(check(r, 'server-rendered-text').status).toBe('fail');
    expect(check(r, 'single-h1').status).toBe('fail');
    expect(check(r, 'jsonld-present').status).toBe('fail');
    expect(check(r, 'lang').status).toBe('fail');
    expect(r.score).toBeLessThan(60);
    expect(r.grade).toBe('F');
  });

  it('flags AI crawlers blocked in robots.txt, with the rule that blocks them', () => {
    const robots = 'User-agent: GPTBot\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nAllow: /';
    const r = analyze(inputs({ robots: { ok: true, res: fetched('https://acme.dev/robots.txt', robots, 200, { 'content-type': 'text/plain' }) } }));
    const search = check(r, 'ai-search-bots');
    expect(search.status).toBe('warn');
    expect(search.summary).toMatch(/OAI-SearchBot, PerplexityBot/);
    expect(search.details!.join('\n')).toMatch(/BLOCKED {2}OAI-SearchBot .*Disallow: \/` \(line 4/);
    expect(search.fix!.snippet).toContain('User-agent: OAI-SearchBot');
    expect(check(r, 'ai-training-bots').status).toBe('warn');
    expect(check(r, 'ai-training-bots').summary).toMatch(/GPTBot/);
  });

  it('fails when Googlebot is blocked or robots.txt errors', () => {
    const blockAll = analyze(inputs({ robots: { ok: true, res: fetched('https://acme.dev/robots.txt', 'User-agent: *\nDisallow: /', 200, { 'content-type': 'text/plain' }) } }));
    expect(check(blockAll, 'ai-search-bots').status).toBe('fail');
    const down = analyze(inputs({ robots: { ok: true, res: fetched('https://acme.dev/robots.txt', '', 503) } }));
    expect(check(down, 'ai-search-bots').status).toBe('fail');
    expect(check(down, 'robots-txt').status).toBe('fail');
    const missing = analyze(inputs({ robots: { ok: true, res: fetched('https://acme.dev/robots.txt', '', 404) } }));
    expect(check(missing, 'ai-search-bots').status).toBe('pass');
    expect(check(missing, 'robots-txt').status).toBe('warn');
  });

  it('detects noindex in meta and X-Robots-Tag', () => {
    const meta = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML.replace('<head>', '<head><meta name="robots" content="noindex, follow">')) }));
    expect(check(meta, 'indexing-directives').status).toBe('fail');
    const header = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML, 200, { 'x-robots-tag': 'googlebot: noindex' }) }));
    expect(check(header, 'indexing-directives').summary).toMatch(/X-Robots-Tag \(googlebot\)/);
    const snippet = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML, 200, { 'x-robots-tag': 'max-snippet:0' }) }));
    expect(check(snippet, 'indexing-directives').status).toBe('warn');
  });

  it('treats an HTML page at /llms.txt as missing', () => {
    const r = analyze(inputs({ llms: { ok: true, res: fetched('https://acme.dev/llms.txt', '<!doctype html><html></html>') } }));
    expect(check(r, 'llms-txt').status).toBe('fail');
    expect(check(r, 'llms-txt').fix!.snippet).toContain('# Acme Studio');
  });

  it('mentions astro-geo only for Astro sites', () => {
    const plain = analyze(inputs({ llms: { ok: true, res: fetched('https://acme.dev/llms.txt', '', 404) } }));
    expect(check(plain, 'llms-txt').fix!.text).not.toMatch(/astro-geo/);
    const astroHtml = GOOD_HTML.replace('<head>', '<head><meta name="generator" content="Astro v5.0.0">');
    const astro = analyze(inputs({ page: fetched('https://acme.dev/', astroHtml), llms: { ok: true, res: fetched('https://acme.dev/llms.txt', '', 404) } }));
    expect(astro.page.isAstro).toBe(true);
    expect(check(astro, 'llms-txt').fix!.text).toMatch(/astro-geo/);
  });

  it('checks sitemap reference in robots.txt', () => {
    const r = analyze(inputs({ robots: { ok: true, res: fetched('https://acme.dev/robots.txt', 'User-agent: *\nAllow: /', 200, { 'content-type': 'text/plain' }) } }));
    expect(check(r, 'sitemap').status).toBe('warn');
    const none = analyze(inputs({ sitemap: { ok: true, res: fetched('https://acme.dev/sitemap.xml', '', 404), source: 'default' } }));
    expect(check(none, 'sitemap').status).toBe('fail');
  });

  it('ranks the biggest fixes first and exports Markdown', () => {
    const html = GOOD_HTML.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '').replace('<title>Acme Studio: fast marketing sites for SaaS</title>', '');
    const r = analyze(inputs({ page: fetched('https://acme.dev/', html) }));
    const fixes = topFixes(r.categories);
    expect(fixes[0]!.id).toBe('jsonld-present');
    expect(fixes.map((f) => f.id)).toContain('title');
    const md = toMarkdown(r);
    expect(md).toMatch(/^# GEO Audit: acme\.dev/);
    expect(md).toContain('## Action plan');
    expect(md).toContain('## Who can see you');
    expect(md).toContain('/insights/json-ld-for-ai');
    expect(md).toContain('```html');
    expect(md).toContain('https://zuanda.web.id/contact');
  });
});

describe('audit (with an injected fetcher)', () => {
  it('fetches the page and well-known files from the final origin', async () => {
    const asked: string[] = [];
    const files: Record<string, Fetched> = {
      'https://acme.dev/': fetched('https://acme.dev/', GOOD_HTML),
      'https://acme.dev/robots.txt': fetched('https://acme.dev/robots.txt', ROBOTS, 200, { 'content-type': 'text/plain' }),
      'https://acme.dev/llms.txt': fetched('https://acme.dev/llms.txt', LLMS, 200, { 'content-type': 'text/plain' }),
      'https://acme.dev/sitemap.xml': fetched('https://acme.dev/sitemap.xml', SITEMAP, 200, { 'content-type': 'application/xml' }),
    };
    const r = await audit('acme.dev', {
      fetcher: async (url) => {
        asked.push(url);
        return files[url] ?? fetched(url, '', 404);
      },
    });
    expect(asked).toEqual(expect.arrayContaining(['https://acme.dev/', 'https://acme.dev/robots.txt', 'https://acme.dev/llms.txt', 'https://acme.dev/llms-full.txt', 'https://acme.dev/sitemap.xml']));
    expect(r.domain).toBe('acme.dev');
    expect(check(r, 'llms-full-txt').status).toBe('warn');
    expect(r.score).toBeGreaterThan(90);
  });

  it('rejects non-HTML pages and unsafe URLs', async () => {
    await expect(audit('acme.dev', { fetcher: async (url) => fetched(url, '%PDF', 200, { 'content-type': 'application/pdf' }) })).rejects.toThrow(/not an HTML page/);
    await expect(audit('http://127.0.0.1/')).rejects.toThrow(/Private/);
  });
});

describe('parsePage', () => {
  it('uses aria-label for split-text headings and skips hidden text', () => {
    const p = parsePage('<html><body><h1 aria-label="Fast sites"><span aria-hidden="true">Fast</span> <span aria-hidden="true">sites</span></h1><div hidden>secret words here</div></body></html>');
    expect(p.headings).toEqual([{ level: 1, text: 'Fast sites' }]);
    expect(p.text).not.toContain('secret');
  });

  it('falls back to image alt text in headings', () => {
    expect(parsePage('<h1><img src="logo.svg" alt="Acme"></h1>').headings[0]!.text).toBe('Acme');
  });

  it('counts words in Latin and CJK text', () => {
    expect(countWords('Hello, world! 123 —')).toBe(3);
    expect(countWords('日本語のテキスト')).toBe(4);
  });

  it('ignores scripts, styles and JSON in visible text', () => {
    const p = parsePage('<body><script>var a = "lots of words in a script";</script><style>.a{}</style><p>Two words</p></body>');
    expect(p.wordCount).toBe(2);
  });
});
