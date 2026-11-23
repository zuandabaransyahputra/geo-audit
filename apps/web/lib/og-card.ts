import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Report } from '@geo-audit/core';

/**
 * Share images must render instantly: link unfurlers (Slack, WhatsApp, LinkedIn, X) give up after a
 * few seconds and share IPs, so the image route never runs an audit. The report page puts the scores
 * into the image URL instead, signed so nobody can mint a card with made-up numbers.
 */
export type CardData = { domain: string; score: number; grade: string; categories: number[] };

const secret = () => process.env.OG_SECRET ?? '';

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 22);
}

const payloadOf = (d: CardData) => [d.domain, d.score, d.grade, d.categories.join('.')].join('|');

/** Query string for /api/og, or just the domain (generic card) when no secret is configured. */
export function cardQuery(report: Report): string {
  const data: CardData = {
    domain: report.domain,
    score: report.score,
    grade: report.grade,
    categories: report.categories.map((c) => c.score),
  };
  const q = new URLSearchParams({ d: data.domain });
  if (!secret()) return q.toString();
  q.set('s', String(data.score));
  q.set('g', data.grade);
  q.set('c', data.categories.join('.'));
  q.set('sig', sign(payloadOf(data)));
  return q.toString();
}

/** Reads a signed card from the query; returns null when anything is missing or tampered with. */
export function readCard(params: URLSearchParams): CardData | null {
  const domain = params.get('d') ?? '';
  const score = Number(params.get('s'));
  const grade = params.get('g') ?? '';
  const categories = (params.get('c') ?? '').split('.').map(Number);
  const sig = params.get('sig') ?? '';
  if (!secret() || !domain || !sig || !Number.isInteger(score) || !/^[A-F]$/.test(grade)) return null;
  if (categories.length !== 4 || categories.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) return null;
  const data: CardData = { domain, score, grade, categories };
  const expected = Buffer.from(sign(payloadOf(data)));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? data : null;
}
