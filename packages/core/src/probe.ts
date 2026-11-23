/**
 * Firewall / CDN probes: after the normal request, fetch the same page once per AI crawler user agent
 * (the vendor's documented string plus a GEO-Audit-probe marker) and compare. A 403 or a challenge page
 * for the crawler while a normal request gets 200 points at a bot rule. Real crawlers are also verified by
 * IP, so results are indicative only. Classification is pure; fetching happens in audit.ts.
 */
import { AI_BOTS, type Bot } from './bots';
import { SITE_URL, VERSION } from './constants';
import { parsePage } from './html';
import type { AuxFetch, Fetched } from './types';

export type ProbeVerdict = 'ok' | 'blocked' | 'challenge' | 'different' | 'error';

/** A probe as fetched (inputs to the pure analysis). */
export interface ProbeFetch {
  token: string;
  userAgent: string;
  res: AuxFetch;
}

/** A classified probe, as reported. */
export interface ProbeResult {
  token: string;
  userAgent: string;
  verdict: ProbeVerdict;
  /** HTTP status of the probe, when it got a response. */
  status?: number;
  /** Words of text in the probe response (2xx only). */
  words?: number;
  /** One short phrase: "got HTTP 403", "got a challenge page" ... */
  detail: string;
}

/** Crawlers we probe, in order. Only those with a vendor-documented User-Agent string. */
export const PROBE_TOKENS = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'GPTBot'];
export const MAX_PROBES = 4;
export const PROBE_TIMEOUT_MS = 5000;
export const PROBE_MAX_BYTES = 512 * 1024;

export function probeUserAgent(bot: Bot): string | undefined {
  if (!bot.userAgent) return undefined;
  return `${bot.userAgent} GEO-Audit-probe/${VERSION.split('.').slice(0, 2).join('.')} (+${SITE_URL})`;
}

/** Bots to probe: allowed by robots.txt, with a documented UA, GPTBot only without a training opt-out. */
export function probeTargets(isAllowed: (token: string) => boolean, trainingOptOut: boolean): { bot: Bot; userAgent: string }[] {
  const out: { bot: Bot; userAgent: string }[] = [];
  for (const token of PROBE_TOKENS) {
    const bot = AI_BOTS.find((b) => b.token === token);
    const ua = bot && probeUserAgent(bot);
    if (!bot || !ua || !isAllowed(token)) continue;
    if (bot.purpose === 'training' && trainingOptOut) continue;
    out.push({ bot, userAgent: ua });
  }
  return out.slice(0, MAX_PROBES);
}

/** Text that only appears on bot-challenge pages (heuristics; the cf-mitigated header is the documented signal). */
const CHALLENGE_MARKERS = [/\/cdn-cgi\/challenge-platform\//i, /<title>\s*Just a moment\.\.\.\s*<\/title>/i, /Vercel Security Checkpoint/i, /captcha-delivery\.com/i, /px-captcha/i];
const BLOCK_STATUSES = new Set([401, 403, 429]);

function isChallenge(res: Fetched): boolean {
  return (res.headers['cf-mitigated'] ?? '').toLowerCase() === 'challenge' || CHALLENGE_MARKERS.some((m) => m.test(res.body.slice(0, 64 * 1024)));
}

/** Words of visible text in an HTML body. */
export function wordsOf(body: string): number {
  return body ? parsePage(body).wordCount : 0;
}

export function classifyProbe(baseline: Fetched, baselineWords: number, probe: ProbeFetch): ProbeResult {
  const base = { token: probe.token, userAgent: probe.userAgent };
  if (!probe.res.ok) return { ...base, verdict: 'error', detail: `failed (${probe.res.error})` };
  const res = probe.res.res;
  const status = res.status;
  if (isChallenge(res) && !isChallenge(baseline)) return { ...base, verdict: 'challenge', status, detail: `got a challenge page (HTTP ${status})` };
  if (BLOCK_STATUSES.has(status) || status >= 500) return { ...base, verdict: 'blocked', status, detail: `got HTTP ${status}` };
  if (status < 200 || status >= 300) return { ...base, verdict: 'different', status, detail: `got HTTP ${status}` };
  const words = wordsOf(res.body);
  if (baselineWords >= 50 && words < baselineWords * 0.3) {
    return { ...base, verdict: 'different', status, words, detail: `got a much shorter page (${words.toLocaleString('en-US')} words instead of ${baselineWords.toLocaleString('en-US')})` };
  }
  return { ...base, verdict: 'ok', status, words, detail: `got HTTP ${status}` };
}

