import type { ProductStatus } from './products';
import type { CategoryId, CategoryResult, CheckResult, Grade } from './types';

export const CATEGORIES: { id: CategoryId; label: string; description: string; weight: number }[] = [
  { id: 'ai-access', label: 'AI access', description: 'Can AI crawlers fetch, index and quote the page?', weight: 0.3 },
  { id: 'content', label: 'AI-readable content', description: 'Is the content there without JavaScript, structured and attributable?', weight: 0.25 },
  { id: 'structured-data', label: 'Structured data', description: 'Does JSON-LD state who you are and what the page is?', weight: 0.2 },
  { id: 'seo', label: 'SEO basics', description: 'The classic signals AI search still builds on.', weight: 0.25 },
  {
    id: 'agent-readiness',
    label: 'Agent readiness',
    description: 'Extras for AI agents and developer tools that act on the page. Reported, not scored.',
    weight: 0,
  },
];

/** True for categories that count toward the overall score. */
export const isScored = (c: Pick<CategoryResult, 'weight'>) => c.weight > 0;

/** "x of y passed" for an unscored category; informational (weight 0) checks are not counted. */
export function tally(checks: CheckResult[]): { passed: number; total: number } {
  const counted = checks.filter((c) => c.weight > 0);
  return { passed: counted.filter((c) => c.status === 'pass').length, total: counted.length };
}

/** Weighted share of earned points, 0..100. Informational (weight 0) checks don't count. */
export function categoryScore(checks: CheckResult[]): number {
  const total = checks.reduce((n, c) => n + c.weight, 0);
  if (!total) return 100;
  const earned = checks.reduce((n, c) => n + c.weight * c.score, 0);
  return Math.round((earned / total) * 100);
}

export function overallScore(categories: Pick<CategoryResult, 'weight' | 'score'>[]): number {
  const total = categories.reduce((n, c) => n + c.weight, 0);
  if (!total) return 0;
  return Math.round(categories.reduce((n, c) => n + c.weight * c.score, 0) / total);
}

export function gradeFor(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

/** Points of the overall score (0..100) a check could still add. */
export function impact(check: CheckResult, categories: CategoryResult[]): number {
  const cat = categories.find((c) => c.id === check.category);
  if (!cat) return 0;
  const total = cat.checks.reduce((n, c) => n + c.weight, 0);
  const catTotal = categories.reduce((n, c) => n + c.weight, 0);
  if (!total || !catTotal) return 0;
  return ((check.weight / total) * (1 - check.score) * cat.weight * 100) / catTotal;
}

/** Failing and warning checks, biggest score gain first. */
export function topFixes(categories: CategoryResult[], limit = 5): (CheckResult & { impact: number })[] {
  return categories
    .flatMap((c) => c.checks)
    .filter((c) => (c.status === 'fail' || c.status === 'warn') && c.weight > 0)
    .map((c) => ({ ...c, impact: impact(c, categories) }))
    .filter((c) => c.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, limit);
}

/* ------------------------------------------------------------------------------------------------ */
/* Score cap                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

export interface ScoreCap {
  /** Highest overall score the page can get while these reasons hold. */
  limit: number;
  /** Plain-language causes, e.g. "ChatGPT search and Claude are blocked by robots.txt". */
  reasons: string[];
}

/** Cap by number of major AI products that are blocked outright. */
export function capForBlocked(n: number): number | null {
  if (n <= 0) return null;
  if (n === 1) return 89;
  if (n === 2) return 79;
  if (n <= 4) return 69;
  return 54;
}

/** Cap when the content only appears after JavaScript runs (an app shell). */
export const APP_SHELL_CAP = 69;

/** What the cap needs to know: the shared product statuses and whether the page is an app shell. */
export interface CapInput {
  products: Pick<ProductStatus, 'product' | 'kind' | 'tier' | 'blockedBy' | 'blockedHow'>[];
  appShell: boolean;
}

/**
 * The lowest cap that applies, or null. `fixed` simulates check fixes (for the action plan): a product
 * stays blocked while any check that blocks it is unfixed.
 */
export function scoreCap(input: CapInput, fixed: ReadonlySet<string> = new Set()): ScoreCap | null {
  const blocked = input.products.filter((p) => p.kind === 'answers' && p.tier === 'major' && p.blockedBy.some((id) => !fixed.has(id)));
  const limits: number[] = [];
  const reasons: string[] = [];
  const byBlocked = capForBlocked(blocked.length);
  if (byBlocked !== null) {
    limits.push(byBlocked);
    const groups = new Map<string, string[]>();
    for (const p of blocked) {
      const how = p.blockedHow ?? 'blocked';
      groups.set(how, [...(groups.get(how) ?? []), p.product]);
    }
    for (const [how, names] of groups) reasons.push(`${joinList(names)} ${names.length === 1 ? 'is' : 'are'} ${how}`);
  }
  if (input.appShell && !fixed.has('server-rendered-text')) {
    limits.push(APP_SHELL_CAP);
    reasons.push('the content only appears after JavaScript runs');
  }
  if (!limits.length) return null;
  return { limit: Math.min(...limits), reasons };
}

/** `Capped at 69: ChatGPT search and Claude are blocked by robots.txt. Without the cap: 81.` */
export function capMessage(cap: ScoreCap, rawScore: number): string {
  const text = cap.reasons.join('; ');
  return `Capped at ${cap.limit}: ${/^[a-z-]+\.txt\b/.test(text) ? text : text.charAt(0).toUpperCase() + text.slice(1)}. Without the cap: ${rawScore}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
