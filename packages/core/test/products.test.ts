import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audit';
import { AI_BOTS } from '../src/bots';
import { PRODUCTS } from '../src/products';
import type { Report } from '../src/types';
import { fetched, inputs } from './fixtures';
import { CLOUDFLARE_MANAGED } from './robots-fixtures';

const robots = (txt: string) => ({ ok: true as const, res: fetched('https://acme.dev/robots.txt', txt, 200, { 'content-type': 'text/plain' }) });
const check = (r: Report, id: string) => r.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;

describe('bot list', () => {
  it('every bot has docs, a verification date and an existing product', () => {
    const ids = new Set(PRODUCTS.map((p) => p.id));
    for (const b of AI_BOTS) {
      if (b.token !== 'Bytespider') expect(b.docsUrl, b.token).toMatch(/^https:\/\//);
      expect(b.verifiedAt, b.token).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ids.has(b.productId), `${b.token} -> ${b.productId}`).toBe(true);
    }
  });

  it('every product crawler is a known bot of that product', () => {
    for (const p of PRODUCTS) {
      for (const t of [...p.primary, ...p.secondary]) expect(AI_BOTS.find((b) => b.token === t)?.productId, `${p.id}: ${t}`).toBe(p.id);
    }
  });

  it('marks ChatGPT-User, Perplexity-User and meta-externalfetcher as may-ignore', () => {
    for (const t of ['ChatGPT-User', 'Perplexity-User', 'meta-externalfetcher']) expect(AI_BOTS.find((b) => b.token === t)?.robotsTxt).toBe('may-ignore');
  });

  it('shows Google-Agent but never scores it, since it generally ignores robots.txt', () => {
    const r = analyze(inputs({ robots: robots('User-agent: Google-Agent\nDisallow: /') }));
    expect(check(r, 'ai-search-bots').status).toBe('pass');
    expect(check(r, 'ai-search-bots').details?.join('\n')).toMatch(/Google-Agent.*not scored/);
    expect(r.score).toBe(analyze(inputs({ robots: robots('User-agent: *\nAllow: /') })).score);
  });

  it('groups products into major and other', () => {
    const major = PRODUCTS.filter((p) => p.tier === 'major').map((p) => p.id);
    expect(major).toEqual(['chatgpt-search', 'claude', 'perplexity', 'google', 'copilot', 'apple']);
    const other = PRODUCTS.filter((p) => p.tier === 'other' && p.kind === 'answers').map((p) => p.id);
    expect(other).toEqual(['duckduckgo', 'amazon', 'mistral', 'meta-ai']);
  });
});

describe('ai-search-bots scores per product', () => {
  it('a blocked "other" product costs half as much as a major one', () => {
    const minor = check(analyze(inputs({ robots: robots('User-agent: DuckAssistBot\nDisallow: /') })), 'ai-search-bots');
    const major = check(analyze(inputs({ robots: robots('User-agent: PerplexityBot\nDisallow: /') })), 'ai-search-bots');
    expect(1 - minor.score).toBeCloseTo((1 - major.score) / 2);
  });

  it('a blocked primary crawler costs a whole major product', () => {
    const r = analyze(inputs({ robots: robots('User-agent: OAI-SearchBot\nDisallow: /') }));
    const c = check(r, 'ai-search-bots');
    const majors = PRODUCTS.filter((p) => p.kind === 'answers' && p.tier === 'major').length;
    const others = PRODUCTS.filter((p) => p.kind === 'answers' && p.tier === 'other').length;
    expect(c.score).toBeCloseTo(1 - 1 / (majors + others * 0.5));
    expect(c.status).toBe('warn');
    expect(c.summary).toMatch(/shuts out ChatGPT search/);
  });

  it('a blocked may-ignore secondary crawler only costs half a product', () => {
    const r = analyze(inputs({ robots: robots('User-agent: ChatGPT-User\nDisallow: /') }));
    const majors = PRODUCTS.filter((p) => p.kind === 'answers' && p.tier === 'major').length;
    const others = PRODUCTS.filter((p) => p.kind === 'answers' && p.tier === 'other').length;
    expect(check(r, 'ai-search-bots').score).toBeCloseTo(1 - 0.5 / (majors + others * 0.5));
  });

  it('still fails when Googlebot or Bingbot is blocked', () => {
    expect(check(analyze(inputs({ robots: robots('User-agent: Bingbot\nDisallow: /') })), 'ai-search-bots').status).toBe('fail');
  });

  it('agrees with the visibility panel', () => {
    const r = analyze(inputs({ robots: robots('User-agent: OAI-SearchBot\nUser-agent: Claude-SearchBot\nDisallow: /') }));
    const blocked = r.insights.visibility.filter((v) => v.kind === 'answers' && v.robots === 'blocked').map((v) => v.id);
    expect(blocked).toEqual(['chatgpt-search', 'claude']);
  });
});

describe('Content-Signal in reports', () => {
  it('is reported on the robots-txt check and in the JSON, without changing the score', () => {
    const r = analyze(inputs({ robots: robots(CLOUDFLARE_MANAGED) }));
    expect(r.contentSignals?.global).toEqual({ search: 'yes', 'ai-train': 'no', use: 'reference' });
    const rt = check(r, 'robots-txt');
    expect(rt.status).toBe('pass');
    expect(rt.details?.join('\n')).toMatch(/Content-Signal \(User-agent: \*, line \d+\): search=yes, ai-train=no/);
    const plain = analyze(inputs({ robots: robots(CLOUDFLARE_MANAGED.replace(/^Content-signal.*$/m, '')) }));
    expect(plain.score).toBe(r.score);
  });
});
