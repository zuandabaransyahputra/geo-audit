import 'server-only';
import { audit, BlockedUrlError, FetchError, normalizeInputUrl, toMarkdown, type Report } from '@geo-audit/core';

/**
 * In-memory, best-effort cache and rate limit. Each serverless instance has its own copy, which is fine
 * for a free tool: the goal is to stop accidental hammering, not to be a perfect quota system.
 * Nothing is persisted; entries disappear after CACHE_TTL_MS or when the instance is recycled.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;
const RATE_WINDOWS = [
  { ms: 60 * 1000, max: 8 },
  { ms: 60 * 60 * 1000, max: 60 },
];

type Entry = { at: number; report: Report; markdown: string };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
const hits = new Map<string, number[]>();

export type AuditOutcome =
  | { ok: true; report: Report; markdown: string; cached: boolean }
  | { ok: false; kind: 'invalid' | 'blocked' | 'fetch' | 'rate-limit' | 'error'; message: string; retryAfter?: number };

function fromCache(key: string): Entry | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return e;
}

function store(key: string, e: Entry) {
  cache.delete(key);
  cache.set(key, e);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

/** Returns seconds to wait when over the limit, otherwise records the hit and returns 0. */
function rateLimit(ip: string): number {
  const now = Date.now();
  const longest = Math.max(...RATE_WINDOWS.map((w) => w.ms));
  const list = (hits.get(ip) ?? []).filter((t) => now - t < longest);
  for (const w of RATE_WINDOWS) {
    const inWindow = list.filter((t) => now - t < w.ms);
    if (inWindow.length >= w.max) {
      hits.set(ip, list);
      return Math.ceil((w.ms - (now - inWindow[0]!)) / 1000);
    }
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 10_000) hits.delete(hits.keys().next().value as string);
  return 0;
}

export function clientIp(h: Headers): string {
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** Validate the input without fetching anything. */
export function parseTarget(input: string | undefined | null): { ok: true; url: URL } | { ok: false; message: string } {
  try {
    return { ok: true, url: normalizeInputUrl(input ?? '') };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Invalid URL.' };
  }
}

export interface ReportOptions {
  trainingOptOut?: boolean;
}

/** Cache key: the URL plus every option that changes the result. */
function cacheKey(href: string, opts: ReportOptions): string {
  return opts.trainingOptOut ? `${href}|training=optout` : href;
}

/** `?training=optout` -> { trainingOptOut: true }. */
export function parseOptions(params: { get(name: string): string | null }): ReportOptions {
  return params.get('training') === 'optout' ? { trainingOptOut: true } : {};
}

export async function getReport(input: string, ip: string, opts: ReportOptions = {}): Promise<AuditOutcome> {
  const target = parseTarget(input);
  if (!target.ok) return { ok: false, kind: 'invalid', message: target.message };
  const key = cacheKey(target.url.href, opts);

  const cached = fromCache(key);
  if (cached) return { ok: true, report: cached.report, markdown: cached.markdown, cached: true };

  let job = inflight.get(key);
  if (!job) {
    const wait = rateLimit(ip);
    if (wait) {
      return { ok: false, kind: 'rate-limit', message: `Too many audits from your network. Try again in ${wait} s.`, retryAfter: wait };
    }
    job = audit(target.url.href, { trainingOptOut: Boolean(opts.trainingOptOut) }).then((report) => {
      const entry = { at: Date.now(), report, markdown: toMarkdown(report) };
      store(key, entry);
      // Also cache under the final URL so shared links to it are instant.
      const finalKey = cacheKey(report.finalUrl, opts);
      if (finalKey !== key) store(finalKey, entry);
      return entry;
    });
    inflight.set(key, job);
    job.finally(() => inflight.delete(key)).catch(() => {});
  }

  try {
    const e = await job;
    return { ok: true, report: e.report, markdown: e.markdown, cached: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    if (err instanceof BlockedUrlError) return { ok: false, kind: 'blocked', message };
    if (err instanceof FetchError) return { ok: false, kind: 'fetch', message };
    console.error('audit failed', err);
    return { ok: false, kind: 'error', message: 'Something went wrong while auditing this URL.' };
  }
}

/** Cached report only; never triggers a fetch. */
export function peekReport(input: string, opts: ReportOptions = {}): Report | undefined {
  const target = parseTarget(input);
  return target.ok ? fromCache(cacheKey(target.url.href, opts))?.report : undefined;
}
