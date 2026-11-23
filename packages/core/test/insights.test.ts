import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audit';
import { ARTICLE_SLUGS, EFFORT, LEARN_MORE, PRODUCTS, actionPlan, type ProductVisibility } from '../src/insights';
import { CHECKS } from '../src/checks';
import type { Report } from '../src/types';
import { fetched, GOOD_HTML, inputs } from './fixtures';

const robots = (txt: string) => ({ ok: true as const, res: fetched('https://acme.dev/robots.txt', txt, 200, { 'content-type': 'text/plain' }) });
const vis = (r: Report, id: string) => r.insights.visibility.find((v) => v.id === id) as ProductVisibility;

/** Strong: everything in place. */
const good = () => analyze(inputs());

/** Medium: no JSON-LD and a missing title and description; still crawlable and server-rendered. */
const medium = () =>
  analyze(
    inputs({
      page: fetched(
        'https://acme.dev/',
        GOOD_HTML.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
          .replace(/<title>.*?<\/title>/, '')
          .replace(/<meta name="description"[^>]*>/, ''),
      ),
      llms: { ok: true, res: fetched('https://acme.dev/llms.txt', '', 404) },
    }),
  );

/** Poor: empty client-side shell, AI search crawlers blocked, no llms.txt, no sitemap. */
const poor = () =>
  analyze(
    inputs({
      page: fetched(
        'https://acme.dev/',
        '<!doctype html><html><head><title>App</title></head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript><script src="/main.js"></script></body></html>',
      ),
      robots: robots('User-agent: GPTBot\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nUser-agent: ClaudeBot\nUser-agent: Claude-SearchBot\nDisallow: /\n'),
      llms: { ok: true, res: fetched('https://acme.dev/llms.txt', '', 404) },
      llmsFull: { ok: true, res: fetched('https://acme.dev/llms-full.txt', '', 404) },
      sitemap: { ok: true, res: fetched('https://acme.dev/sitemap.xml', '', 404), source: 'default' },
    }),
  );

describe('summary', () => {
  it('reads as good news for a strong site', () => {
    const s = good().insights.summary;
    expect(s).toMatch(/^acme\.dev scores 100\/100: it is well prepared/);
    expect(s).toContain('ChatGPT search, Claude, Perplexity, Google\'s AI Overviews, Microsoft Copilot and Siri can all reach and read the page.');
    expect(s).toMatch(/nothing significant left to fix/);
    expect(s).not.toMatch(/blocked|shut out|gap/i);
  });

  it('names the biggest gap and the projected score for a medium site', () => {
    const r = medium();
    const s = r.insights.summary;
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(r.score).toBeLessThan(90);
    expect(s).toMatch(/scores \d+\/100: (AI assistants can use most of it|there are significant gaps)/);
    expect(s).toContain('can all reach and read the page');
    expect(s).toMatch(/The biggest gap is that there is no valid JSON-LD/);
    expect(s).toMatch(/quick wins? in the action plan could lift the score to about \d+/);
    // Never claims anything is blocked when nothing is.
    expect(s).not.toMatch(/shut out|partly/);
  });

  it('is blunt for a poor site and does not contradict the visibility panel', () => {
    const r = poor();
    const s = r.insights.summary;
    expect(r.score).toBeLessThan(55);
    expect(s).toMatch(/right now most AI assistants will struggle/);
    expect(s).toMatch(/ChatGPT search, Claude and Perplexity are shut out/);
    expect(s).toMatch(/Microsoft Copilot and Siri only partly get through/);
    expect(s).toMatch(/Google's AI Overviews can reach and read the page/);
    expect(s).toMatch(/The biggest gap is that/);
    expect(s.split(/(?<=\.)\s/).length).toBeGreaterThanOrEqual(2);
    expect(s.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(5);
  });

  it('mentions each blocked answer product exactly as the panel says', () => {
    for (const r of [good(), medium(), poor()]) {
      for (const v of r.insights.visibility.filter((x) => x.kind === 'answers')) {
        const short = { 'chatgpt-search': 'ChatGPT search', claude: 'Claude', perplexity: 'Perplexity', google: "Google's AI Overviews", copilot: 'Microsoft Copilot', apple: 'Siri' }[v.id]!;
        if (v.answers === 'blocked') expect(r.insights.summary).toMatch(new RegExp(`${short}[^.]*shut out`));
        if (v.answers === 'visible' && r.insights.summary.includes('shut out')) {
          expect(r.insights.summary).not.toMatch(new RegExp(`${short} (is|are) shut out`));
        }
      }
    }
  });
});

describe('summary edge cases', () => {
  it('does not call a site with assistants shut out "usable by most assistants"', () => {
    const r = analyze(inputs({ robots: robots('User-agent: OAI-SearchBot\nUser-agent: Claude-SearchBot\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://acme.dev/sitemap.xml') }));
    // Three major products blocked: capped at 69 even though the page itself scores higher.
    expect(r.score).toBe(69);
    expect(r.rawScore).toBeGreaterThanOrEqual(70);
    expect(r.insights.summary).toMatch(/several AI assistants are kept out/);
    expect(r.insights.summary).toMatch(/capped at 69 because ChatGPT search, Claude and Perplexity are blocked by robots\.txt; without the cap it would be \d+\./);
    expect(r.insights.summary).not.toMatch(/can use most of it|well prepared/);
  });

  it('attributes the biggest gap to its own category', () => {
    const s = poor().insights.summary;
    // The top gap in the poor fixture is server-rendered text (content), never "structured data".
    const gap = /The biggest gap is that ([^.]*)\./.exec(s)![1]!;
    if (/JavaScript/.test(gap)) expect(gap).not.toMatch(/structured data|SEO basics|AI access/);
  });
});

describe('visibility', () => {
  it('marks everything visible on an open site', () => {
    expect(good().insights.visibility.every((v) => v.status === 'visible')).toBe(true);
  });

  it('maps primary crawlers to blocked and secondary ones to partly', () => {
    const r = analyze(inputs({ robots: robots('User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n\nUser-agent: Applebot-Extended\nDisallow: /\n\nUser-agent: Claude-User\nDisallow: /') }));
    expect(vis(r, 'chatgpt-search').status).toBe('blocked');
    expect(vis(r, 'chatgpt-search').reason).toMatch(/OAI-SearchBot/);
    expect(vis(r, 'chatgpt-training').status).toBe('visible');
    // Google-Extended does not affect Search / AI Overviews, so Google is only "partly".
    expect(vis(r, 'google').status).toBe('partly');
    expect(vis(r, 'apple').status).toBe('partly');
    expect(vis(r, 'claude').status).toBe('partly');
    expect(vis(r, 'perplexity').status).toBe('visible');
  });

  it('does not count training-only opt-outs against answers', () => {
    const r = analyze(inputs({ robots: robots('User-agent: Google-Extended\nUser-agent: Applebot-Extended\nUser-agent: ClaudeBot\nUser-agent: GPTBot\nDisallow: /') }));
    for (const id of ['google', 'apple', 'claude']) {
      expect(vis(r, id).status).toBe('partly');
      expect(vis(r, id).answers).toBe('visible');
      expect(vis(r, id).reason).toMatch(/\(training only\)\. It can still find and cite the page\.$/);
    }
    expect(vis(r, 'chatgpt-training').status).toBe('blocked');
    expect(r.insights.summary).toContain('can all reach and read the page');
    expect(r.insights.summary).not.toMatch(/partly|shut out/);
  });

  it('writes one reason per cause, keeping robots.txt lower case', () => {
    const r = analyze(inputs({ robots: robots('User-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nDisallow: /') }));
    expect(vis(r, 'chatgpt-search').reason).toBe('robots.txt blocks OAI-SearchBot and ChatGPT-User.');
  });

  it('treats the "others" group as a set: some blocked = partly, all blocked = blocked', () => {
    const some = analyze(inputs({ robots: robots('User-agent: CCBot\nDisallow: /') }));
    expect(vis(some, 'others').status).toBe('partly');
    const all = analyze(inputs({ robots: robots('User-agent: CCBot\nUser-agent: Bytespider\nDisallow: /') }));
    expect(vis(all, 'others').status).toBe('blocked');
  });

  it('applies noindex: blocked where documented (Google, Bing), partly elsewhere, training unaffected', () => {
    const r = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML.replace('<head>', '<head><meta name="robots" content="noindex">')) }));
    expect(vis(r, 'google').status).toBe('blocked');
    expect(vis(r, 'copilot').status).toBe('blocked');
    expect(vis(r, 'perplexity').status).toBe('partly');
    expect(vis(r, 'chatgpt-training').status).toBe('visible');
  });

  it('applies nosnippet to Google and Apple answers only', () => {
    const r = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML, 200, { 'x-robots-tag': 'nosnippet' }) }));
    expect(vis(r, 'google').status).toBe('partly');
    expect(vis(r, 'apple').status).toBe('partly');
    expect(vis(r, 'chatgpt-search').status).toBe('visible');
  });

  it('downgrades JS-only pages for crawlers that do not render, but not Google', () => {
    const r = poor();
    expect(vis(r, 'google').status).toBe('visible');
    expect(vis(r, 'copilot').status).toBe('partly');
    expect(vis(r, 'copilot').reason).toMatch(/JavaScript/);
    expect(vis(r, 'chatgpt-search').status).toBe('blocked');
  });

  it('treats a 5xx robots.txt as blocking everything, and a 404 page as gone', () => {
    const down = analyze(inputs({ robots: { ok: true, res: fetched('https://acme.dev/robots.txt', '', 503) } }));
    expect(down.insights.visibility.every((v) => v.status === 'blocked')).toBe(true);
    const gone = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML, 404) }));
    expect(gone.insights.visibility.every((v) => v.status === 'blocked')).toBe(true);
  });

  it('lists crawler tokens that exist in the bot list', () => {
    for (const p of PRODUCTS) expect(p.primary.length + p.secondary.length).toBeGreaterThan(0);
    const r = good();
    for (const v of r.insights.visibility) for (const c of v.crawlers) expect(c.allowed).toBe(true);
  });
});

describe('action plan', () => {
  it('is empty for a perfect site', () => {
    const p = good().insights.plan;
    expect([...p.quickWins, ...p.thisWeek, ...p.bigger]).toEqual([]);
    expect(p.afterQuickWins).toBe(p.current);
    expect(p.afterAll).toBe(100);
  });

  it('groups by effort and orders by points within a group', () => {
    const p = poor().insights.plan;
    for (const group of [p.quickWins, p.thisWeek, p.bigger]) {
      for (let i = 1; i < group.length; i++) expect(group[i - 1]!.points).toBeGreaterThanOrEqual(group[i]!.points);
    }
    expect(p.quickWins.every((i) => i.effort === 'minutes')).toBe(true);
    expect(p.thisWeek.every((i) => i.effort === 'hours')).toBe(true);
    expect(p.bigger.map((i) => i.id)).toEqual(['server-rendered-text']);
    expect(p.quickWins.map((i) => i.id)).toEqual(expect.arrayContaining(['single-h1', 'ai-search-bots', 'lang']));
    expect(p.quickWins.every((i) => i.effortLabel && i.learnMore)).toBe(true);
  });

  it('projects the score after quick wins and after the full plan', () => {
    const r = medium();
    const p = r.insights.plan;
    expect(p.current).toBe(r.score);
    expect(p.afterQuickWins).toBeGreaterThan(p.current);
    expect(p.afterAll).toBeGreaterThanOrEqual(p.afterQuickWins);
    expect(p.afterAll).toBe(100);
    // Quick wins' points add up to the projected gain (within rounding).
    const gain = p.quickWins.reduce((n, i) => n + i.points, 0);
    expect(Math.abs(p.current + gain - p.afterQuickWins)).toBeLessThanOrEqual(1.5);
  });

  it('only includes failing or warning checks with weight', () => {
    const r = medium();
    const ids = new Set([...r.insights.plan.quickWins, ...r.insights.plan.thisWeek, ...r.insights.plan.bigger].map((i) => i.id));
    for (const c of r.categories.flatMap((x) => x.checks)) {
      if (c.status === 'pass' || c.status === 'info' || c.weight === 0) expect(ids.has(c.id)).toBe(false);
    }
    expect(actionPlan([]).afterAll).toBe(0);
  });
});

describe('strengths and metadata', () => {
  it('lists strengths only for passing checks', () => {
    expect(good().insights.strengths.length).toBeGreaterThanOrEqual(5);
    const s = poor().insights.strengths.join(' ');
    expect(s).not.toMatch(/JSON-LD|llms\.txt|readable without JavaScript/);
  });

  it('has effort and an existing article for every scored check', () => {
    const ids = Object.values(CHECKS).flatMap((fns) => fns.map((fn) => fn.name));
    expect(ids.length).toBe(30);
    const r = good();
    for (const c of r.categories.flatMap((x) => x.checks)) {
      expect(LEARN_MORE[c.id], c.id).toBeDefined();
      expect(ARTICLE_SLUGS).toContain(c.learnMore);
      if (c.weight > 0) expect(EFFORT[c.id], c.id).toBeDefined();
    }
  });
});
