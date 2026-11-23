import { describe, expect, it } from 'vitest';
import { audit } from '../src/audit';
import { classifyProbe, probeTargets } from '../src/probe';
import type { SafeFetchOptions } from '../src/fetch';
import type { Fetched, Report } from '../src/types';
import { fetched, GOOD_HTML, LLMS, ROBOTS, SITEMAP, words } from './fixtures';

const check = (r: Report, id: string) => r.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
const vis = (r: Report, id: string) => r.insights.visibility.find((v) => v.id === id)!;

type Calls = { url: string; ua?: string; timeoutMs?: number; maxBytes?: number }[];

/** A fake site: `asBot` decides what a probe with that crawler token gets. */
function site(asBot: (token: string, url: string) => Fetched | Error | undefined, robots = ROBOTS) {
  const calls: Calls = [];
  const files: Record<string, Fetched> = {
    'https://acme.dev/': fetched('https://acme.dev/', GOOD_HTML),
    'https://acme.dev/robots.txt': fetched('https://acme.dev/robots.txt', robots, 200, { 'content-type': 'text/plain' }),
    'https://acme.dev/llms.txt': fetched('https://acme.dev/llms.txt', LLMS, 200, { 'content-type': 'text/plain' }),
    'https://acme.dev/sitemap.xml': fetched('https://acme.dev/sitemap.xml', SITEMAP, 200, { 'content-type': 'application/xml' }),
  };
  const fetcher = async (url: string, opts: SafeFetchOptions): Promise<Fetched> => {
    calls.push({ url, ua: opts.userAgent, timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes });
    const token = /compatible; ([A-Za-z-]+)\//.exec(opts.userAgent ?? '')?.[1];
    if (token) {
      const r = asBot(token, url);
      if (r instanceof Error) throw r;
      if (r) return r;
    }
    return files[url] ?? fetched(url, '', 404);
  };
  return { fetcher, calls };
}

describe('firewall probes', () => {
  it('probes allowed crawlers with the vendor UA plus a marker, 5 s and 512 KB, no retries', async () => {
    const { fetcher, calls } = site(() => undefined);
    const r = await audit('acme.dev', { fetcher });
    const probes = calls.filter((c) => c.ua);
    expect(probes.map((c) => /compatible; ([A-Za-z-]+)\//.exec(c.ua!)![1])).toEqual(['OAI-SearchBot', 'PerplexityBot', 'GPTBot']);
    expect(probes[0]!.ua).toBe(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot GEO-Audit-probe/0.2 (+https://geoaudit-tool.vercel.app)',
    );
    for (const p of probes) {
      expect(p.url).toBe('https://acme.dev/');
      expect(p.timeoutMs).toBe(5000);
      expect(p.maxBytes).toBe(512 * 1024);
    }
    expect(check(r, 'firewall-probe').status).toBe('pass');
    expect(r.probes.every((p) => p.verdict === 'ok')).toBe(true);
  });

  it('flags a 403 for a crawler while a normal request gets 200', async () => {
    const { fetcher } = site((t, url) => (t === 'OAI-SearchBot' ? fetched(url, 'Forbidden', 403) : undefined));
    const r = await audit('acme.dev', { fetcher });
    const c = check(r, 'firewall-probe');
    expect(c.status).toBe('warn');
    expect(c.score).toBeCloseTo(2 / 3);
    expect(c.summary).toBe(
      'OAI-SearchBot got HTTP 403 while a normal request got 200. A firewall or bot rule likely blocks it. Real crawlers are also verified by IP, so confirm this in your CDN logs.',
    );
    expect(c.fix?.text).toMatch(/Cloudflare.*Vercel.*WAF/);
    // Visibility: partly, not blocked, and no cap.
    expect(vis(r, 'chatgpt-search').status).toBe('partly');
    expect(vis(r, 'chatgpt-search').reason).toMatch(/test request as OAI-SearchBot got HTTP 403/);
    expect(r.cap).toBeNull();
  });

  it('recognises a Cloudflare challenge by its cf-mitigated header', async () => {
    const { fetcher } = site((t, url) => (t === 'PerplexityBot' ? fetched(url, '<html><title>One moment</title></html>', 403, { 'cf-mitigated': 'challenge' }) : undefined));
    const r = await audit('acme.dev', { fetcher });
    expect(r.probes.find((p) => p.token === 'PerplexityBot')?.verdict).toBe('challenge');
    expect(check(r, 'firewall-probe').summary).toMatch(/^PerplexityBot got a challenge page \(HTTP 403\)/);
    expect(vis(r, 'perplexity').status).toBe('partly');
  });

  it('flags a page that is much shorter for a crawler', async () => {
    const { fetcher } = site((t, url) => (t === 'GPTBot' ? fetched(url, `<html><body><p>${words(20)}</p></body></html>`) : undefined));
    const r = await audit('acme.dev', { fetcher });
    const p = r.probes.find((x) => x.token === 'GPTBot')!;
    expect(p.verdict).toBe('different');
    expect(p.detail).toMatch(/much shorter page \(20 words instead of \d+\)/);
    // "different" is reported but does not change visibility.
    expect(vis(r, 'chatgpt-training').status).toBe('visible');
  });

  it('reports network errors as errors', async () => {
    const { fetcher } = site((t) => (t === 'OAI-SearchBot' ? new Error('The request timed out after 5 s.') : undefined));
    const r = await audit('acme.dev', { fetcher });
    expect(r.probes.find((x) => x.token === 'OAI-SearchBot')?.verdict).toBe('error');
    expect(check(r, 'firewall-probe').summary).toMatch(/may be a network issue/);
  });

  it('skips crawlers robots.txt blocks, and GPTBot under a training opt-out', async () => {
    const { fetcher, calls } = site(() => undefined, 'User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /');
    await audit('acme.dev', { fetcher, trainingOptOut: true });
    expect(calls.filter((c) => c.ua).map((c) => /compatible; ([A-Za-z-]+)\//.exec(c.ua!)![1])).toEqual(['PerplexityBot']);
  });

  it('does not probe when the normal request is not 2xx', () => {
    expect(probeTargets(() => true, false).length).toBeLessThanOrEqual(4);
    const base = fetched('https://acme.dev/', GOOD_HTML);
    expect(classifyProbe(base, 300, { token: 'X', userAgent: 'x', res: { ok: true, res: fetched('https://acme.dev/', GOOD_HTML) } }).verdict).toBe('ok');
    expect(classifyProbe(base, 300, { token: 'X', userAgent: 'x', res: { ok: true, res: fetched('https://acme.dev/', '', 503) } }).verdict).toBe('blocked');
    expect(classifyProbe(base, 300, { token: 'X', userAgent: 'x', res: { ok: true, res: fetched('https://acme.dev/', '', 404) } }).verdict).toBe('different');
  });

  it('runs no probes for a non-2xx page', async () => {
    const calls: Calls = [];
    const r = await audit('acme.dev', {
      fetcher: async (url, opts) => {
        calls.push({ url, ua: opts.userAgent });
        return url === 'https://acme.dev/' ? fetched(url, GOOD_HTML, 500) : fetched(url, '', 404);
      },
    });
    expect(calls.some((c) => c.ua)).toBe(false);
    expect(check(r, 'firewall-probe').status).toBe('info');
  });
});
