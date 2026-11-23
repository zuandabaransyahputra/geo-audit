import type { PageModel } from '../html';
import type { ProbeResult } from '../probe';
import type { JsonLdExtraction } from '../jsonld';
import type { ParsedRobots } from '../robots';
import type { AuditInputs, CheckResult, Status, TrainingOptOutSource } from '../types';

export interface CheckContext {
  inputs: AuditInputs;
  page: PageModel;
  html: string;
  url: URL;
  robots: ParsedRobots | null;
  robotsState: 'ok' | 'missing' | 'html' | 'error' | 'server-error';
  jsonld: JsonLdExtraction;
  siteName: string;
  description?: string;
  /** Training crawlers are blocked on purpose (asked for, or Content-Signal ai-train=no for every crawler). */
  trainingOptOut: boolean;
  trainingOptOutSource: TrainingOptOutSource | null;
  /** Firewall probes classified against the baseline request. */
  probes: ProbeResult[];
}

export type Spec = Omit<CheckResult, 'status' | 'score' | 'summary'>;

export function result(spec: Spec, status: Status, summary: string, extra: Partial<CheckResult> = {}, score?: number): CheckResult {
  const s = score ?? (status === 'pass' || status === 'info' ? 1 : status === 'warn' ? 0.5 : 0);
  return { ...spec, status, summary, score: Math.max(0, Math.min(1, s)), ...extra };
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function truncate(s: string, n: number): string {
  const chars = [...s];
  return chars.length > n ? `${chars.slice(0, n - 1).join('')}…` : s;
}
