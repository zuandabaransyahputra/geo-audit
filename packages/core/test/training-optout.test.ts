import { describe, expect, it } from 'vitest';
import { analyze, audit } from '../src/audit';
import { toMarkdown } from '../src/markdown';
import type { Fetched, Report } from '../src/types';
import { fetched, GOOD_HTML, inputs } from './fixtures';
import { CLOUDFLARE_MANAGED } from './robots-fixtures';

const robots = (txt: string) => ({ ok: true as const, res: fetched('https://acme.dev/robots.txt', txt, 200, { 'content-type': 'text/plain' }) });
const check = (r: Report, id: string) => r.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
const vis = (r: Report, id: string) => r.insights.visibility.find((v) => v.id === id)!;
const TRAINING_BLOCKED = 'User-agent: GPTBot\nUser-agent: ClaudeBot\nUser-agent: CCBot\nUser-agent: Bytespider\nUser-agent: Google-Extended\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://acme.dev/sitemap.xml';
const plan = (r: Report) => [...r.insights.plan.quickWins, ...r.insights.plan.thisWeek, ...r.insights.plan.bigger, ...r.insights.plan.optional];

describe('training opt-out', () => {
  it('without it, blocked training crawlers are a "this week" item, never a quick win', () => {
    const r = analyze(inputs({ robots: robots(TRAINING_BLOCKED) }));
    expect(check(r, 'ai-training-bots').status).toBe('warn');
    expect(r.insights.plan.quickWins.some((i) => i.id === 'ai-training-bots')).toBe(false);
    const item = r.insights.plan.thisWeek.find((i) => i.id === 'ai-training-bots');
    expect(item?.note).toBe('Only if you want models to learn from the site');
    expect(vis(r, 'chatgpt-training').status).toBe('blocked');
    expect(r.options).toEqual({ trainingOptOut: false, trainingOptOutSource: null });
  });

  it('when asked for, scores training blocks as info and shows "Opted out"', () => {
    const r = analyze(inputs({ options: { trainingOptOut: true }, robots: robots(TRAINING_BLOCKED) }));
    const c = check(r, 'ai-training-bots');
    expect(c.status).toBe('info');
    expect(c.score).toBe(1);
    expect(c.summary).toBe('Training crawlers are blocked on purpose, so this does not count against the score.');
    expect(plan(r).some((i) => i.id === 'ai-training-bots')).toBe(false);
    expect(vis(r, 'chatgpt-training').status).toBe('opted-out');
    expect(vis(r, 'others').status).toBe('opted-out');
    // Training-only parts of answer products no longer lower their status.
    expect(vis(r, 'claude').status).toBe('visible');
    expect(vis(r, 'claude').reason).toMatch(/opted out on purpose/);
    expect(r.score).toBe(analyze(inputs()).score);
    expect(r.options).toEqual({ trainingOptOut: true, trainingOptOutSource: 'request' });
    expect(toMarkdown(r)).toContain('⚪ Opted out');
    expect(toMarkdown(r)).toContain('&training=optout');
  });

  it('turns on by itself when robots.txt says Content-Signal ai-train=no for every crawler', () => {
    const r = analyze(inputs({ robots: robots(CLOUDFLARE_MANAGED) }));
    expect(r.options).toEqual({ trainingOptOut: true, trainingOptOutSource: 'content-signal' });
    expect(check(r, 'ai-training-bots').status).toBe('info');
    expect(check(r, 'ai-training-bots').summary).toMatch(/Content-Signal: ai-train=no/);
    // A bot-specific signal does not count.
    const own = analyze(inputs({ robots: robots(`User-agent: GPTBot\nContent-Signal: ai-train=no\nDisallow: /\n\nUser-agent: *\nAllow: /`) }));
    expect(own.options.trainingOptOut).toBe(false);
  });

  it('does not hide blocked search crawlers', () => {
    const r = analyze(inputs({ options: { trainingOptOut: true }, robots: robots('User-agent: OAI-SearchBot\nUser-agent: GPTBot\nDisallow: /') }));
    expect(vis(r, 'chatgpt-search').status).toBe('blocked');
    expect(check(r, 'ai-search-bots').status).not.toBe('pass');
  });

  it('is passed through audit()', async () => {
    const files: Record<string, Fetched> = {
      'https://acme.dev/': fetched('https://acme.dev/', GOOD_HTML),
      'https://acme.dev/robots.txt': fetched('https://acme.dev/robots.txt', TRAINING_BLOCKED, 200, { 'content-type': 'text/plain' }),
    };
    const r = await audit('acme.dev', { trainingOptOut: true, fetcher: async (url) => files[url] ?? fetched(url, '', 404) });
    expect(r.options.trainingOptOut).toBe(true);
    expect(check(r, 'ai-training-bots').status).toBe('info');
  });
});
