import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audit';
import { classifyProbe } from '../src/probe';
import type { Report } from '../src/types';
import { fetched, GOOD_HTML, inputs, words } from './fixtures';
import { NYT_LIKE } from './robots-fixtures';

const check = (r: Report, id: string) => r.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
const vis = (r: Report, id: string) => r.insights.visibility.find((v) => v.id === id)!;
const robots = (txt: string) => ({ ok: true as const, res: fetched('https://acme.dev/robots.txt', txt, 200, { 'content-type': 'text/plain' }) });
const allPlan = (r: Report) => [...r.insights.plan.quickWins, ...r.insights.plan.thisWeek, ...r.insights.plan.bigger];

describe('review fixes', () => {
  it('a short page that is fully in the HTML is thin, not an app shell: no cap, no JavaScript wording', () => {
    const short = GOOD_HTML.replace(/<p>[\s\S]*?<\/p>/, `<p>${words(16)}</p>`);
    const r = analyze(inputs({ page: fetched('https://acme.dev/', short) }));
    expect(check(r, 'server-rendered-text').status).toBe('fail');
    expect(r.cap).toBeNull();
    expect(r.insights.summary).not.toMatch(/JavaScript/);
    expect(vis(r, 'chatgpt-search').status).toBe('visible');
  });

  it('a real app shell is still capped at 69 with JavaScript wording, not access wording', () => {
    const shell = GOOD_HTML.replace(/<body>[\s\S]*<\/body>/, '<body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body>');
    const r = analyze(inputs({ page: fetched('https://acme.dev/', shell) }));
    expect(check(r, 'server-rendered-text').status).toBe('fail');
    if (r.rawScore > 69) {
      expect(r.cap?.reasons).toEqual(['the content only appears after JavaScript runs']);
      expect(r.insights.summary).not.toMatch(/assistant is let in|kept out/);
    }
    expect(vis(r, 'chatgpt-search').reason).toMatch(/JavaScript/);
  });

  it('a noindex for one crawler only affects that crawler\'s product', () => {
    const r = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML.replace('<head>', '<head><meta name="bingbot" content="noindex">')) }));
    expect(vis(r, 'copilot').status).toBe('blocked');
    expect(vis(r, 'google').status).toBe('visible');
    // Only Copilot counts toward the cap (89 at most); the failing indexing check may already put it lower.
    expect(r.score).toBeLessThanOrEqual(89);
    expect(r.cap?.reasons.join(' ') ?? '').not.toMatch(/Google/);
    const header = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML, 200, { 'x-robots-tag': 'googlebot: noindex' }) }));
    expect(vis(header, 'google').status).toBe('blocked');
    expect(vis(header, 'copilot').status).toBe('visible');
    const generic = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML.replace('<head>', '<head><meta name="robots" content="noindex">')) }));
    expect(vis(generic, 'google').status).toBe('blocked');
    expect(vis(generic, 'copilot').status).toBe('blocked');
  });

  it('compares a truncated probe with the same slice of the normal page', () => {
    const body = `<html><body>${Array.from({ length: 40 }, () => `<p>${words(100)}</p>`).join('')}</body></html>`;
    const base = fetched('https://acme.dev/', body);
    const cut = body.slice(0, Math.floor(body.length / 4));
    const probe = { ...fetched('https://acme.dev/', cut), truncated: true };
    const v = classifyProbe(base, 4000, { token: 'GPTBot', userAgent: 'x', res: { ok: true, res: probe } });
    expect(v.verdict).toBe('ok');
  });

  it('a firewall check that ran no probes earns nothing and says why', () => {
    const offline = analyze(inputs());
    expect(check(offline, 'firewall-probe')).toMatchObject({ status: 'info', weight: 0 });
    expect(check(offline, 'firewall-probe').summary).toMatch(/only sent during a live audit/);
    const none = analyze(inputs({ probes: [] }));
    expect(check(none, 'firewall-probe').summary).toMatch(/allows none of the crawlers/);
  });

  it('while capped, fixes that cannot lift the cap are marked "after the cap" and rank below the one that can', () => {
    const page = GOOD_HTML.replace(/<title>.*?<\/title>/, '<title>Acme</title>');
    const r = analyze(inputs({ page: fetched('https://acme.dev/', page), robots: robots(NYT_LIKE) }));
    expect(r.cap?.limit).toBe(69);
    const title = allPlan(r).find((i) => i.id === 'title')!;
    expect(title.afterCap).toBe(true);
    expect(allPlan(r).find((i) => i.id === 'ai-search-bots')?.afterCap).toBeUndefined();
    expect(r.insights.plan.quickWins[0]!.id).toBe('ai-search-bots');
  });

  it('only suggests profile links as sameAs', () => {
    const html = GOOD_HTML.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '').replace(
      '<body>',
      '<body><a href="https://www.youtube.com/watch?v=abc">video</a><a href="https://github.com/vercel/next.js/issues/123">issue</a><a href="https://www.youtube.com/@acme">yt</a><a href="https://github.com/acme">gh</a><a href="https://x.com/intent/post?text=x">share</a><a href="https://x.com/acme">x</a>',
    );
    const r = analyze(inputs({ page: fetched('https://acme.dev/', html) }));
    const snippet = check(r, 'jsonld-present').fix!.snippet!;
    const org = JSON.parse(/<script[^>]*>\n([\s\S]*)\n<\/script>/.exec(snippet)![1]!)['@graph'][0];
    expect(org.sameAs).toEqual(['https://www.youtube.com/@acme', 'https://github.com/acme', 'https://x.com/acme']);
  });
});
