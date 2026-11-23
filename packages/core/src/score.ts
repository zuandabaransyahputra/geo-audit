import type { CategoryId, CategoryResult, CheckResult, Grade } from './types';

export const CATEGORIES: { id: CategoryId; label: string; description: string; weight: number }[] = [
  { id: 'ai-access', label: 'AI access', description: 'Can AI crawlers fetch, index and quote the page?', weight: 0.3 },
  { id: 'content', label: 'AI-readable content', description: 'Is the content there without JavaScript, structured and attributable?', weight: 0.25 },
  { id: 'structured-data', label: 'Structured data', description: 'Does JSON-LD state who you are and what the page is?', weight: 0.2 },
  { id: 'seo', label: 'SEO basics', description: 'The classic signals AI search still builds on.', weight: 0.25 },
];

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
