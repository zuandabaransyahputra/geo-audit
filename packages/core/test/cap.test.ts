import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audit';
import { toMarkdown } from '../src/markdown';
import { capForBlocked, capMessage, scoreCap } from '../src/score';
import { fetched, inputs } from './fixtures';
import { NYT_LIKE } from './robots-fixtures';

const robots = (txt: string) => ({ ok: true as const, res: fetched('https://acme.dev/robots.txt', txt, 200, { 'content-type': 'text/plain' }) });
const SPA = '<!doctype html><html lang="en"><head><title>Acme app: dashboards for teams</title><meta name="viewport" content="width=device-width"></head><body><div id="root"></div><script src="/main.js"></script></body></html>';

describe('score cap', () => {
  it('maps the number of blocked major products to a limit', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(capForBlocked)).toEqual([null, 89, 79, 69, 69, 54, 54]);
  });

  it('caps an NYT-like robots.txt at 69, grade D', () => {
    const r = analyze(inputs({ robots: robots(NYT_LIKE) }));
    expect(r.rawScore).toBeGreaterThan(69);
    expect(r.cap).toEqual({ limit: 69, reasons: ['ChatGPT search, Claude and Perplexity are blocked by robots.txt'] });
    expect(r.score).toBe(69);
    expect(r.grade).toBe('D');
    expect(capMessage(r.cap!, r.rawScore)).toBe(`Capped at 69: ChatGPT search, Claude and Perplexity are blocked by robots.txt. Without the cap: ${r.rawScore}.`);
    expect(toMarkdown(r)).toContain('Capped at 69');
  });

  it('re-evaluates the cap in the action plan projections', () => {
    const r = analyze(inputs({ robots: robots(NYT_LIKE) }));
    const plan = r.insights.plan;
    expect(plan.current).toBe(69);
    // Unblocking the crawlers is a quick win that lifts the cap.
    expect(plan.quickWins[0]?.id).toBe('ai-search-bots');
    expect(plan.afterQuickWins).toBeGreaterThan(r.rawScore);
  });

  it('caps a client-side app shell at 69 and takes the lowest cap that applies', () => {
    const shell = analyze(inputs({ page: fetched('https://acme.dev/', SPA) }));
    expect(shell.cap === null || shell.cap.limit === 69).toBe(true);
    expect(shell.score).toBeLessThanOrEqual(69);
    const both = scoreCap({
      appShell: true,
      products: ['A', 'B', 'C', 'D', 'E'].map((product) => ({ product, kind: 'answers' as const, tier: 'major' as const, blockedBy: ['ai-search-bots'], blockedHow: 'blocked by robots.txt' })),
    });
    expect(both?.limit).toBe(54);
    expect(both?.reasons).toHaveLength(2);
  });

  it('does not cap when nothing major is blocked, and ignores "other" products', () => {
    const r = analyze(inputs());
    expect(r.cap).toBeNull();
    expect(r.score).toBe(r.rawScore);
    expect(scoreCap({ appShell: false, products: [{ product: 'X', kind: 'answers', tier: 'other', blockedBy: ['ai-search-bots'] }] })).toBeNull();
  });

  it('lets a simulated fix lift the cap', () => {
    const input = { appShell: false, products: [{ product: 'X', kind: 'answers' as const, tier: 'major' as const, blockedBy: ['ai-search-bots', 'indexing-directives'] }] };
    expect(scoreCap(input, new Set(['ai-search-bots']))?.limit).toBe(89);
    expect(scoreCap(input, new Set(['ai-search-bots', 'indexing-directives']))).toBeNull();
  });
});
