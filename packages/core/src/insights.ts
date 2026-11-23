/**
 * Rule-based insights on top of the check results: a plain-language summary, which AI products can see
 * the page, an action plan ordered by points per effort, and strengths. No AI API involved: every
 * sentence comes from a template and the same data the checks used, so it can never contradict them.
 */
import type { CheckContext } from './checks';
import { capitalise, list, PRODUCTS, productStatuses, type ProductStatus, type Visibility } from './products';
import { categoryScore, impact, isScored, overallScore, scoreCap, type CapInput, type ScoreCap } from './score';
import type { CategoryResult, CheckResult } from './types';

/* ------------------------------------------------------------------------------------------------ */
/* Articles ("Learn more")                                                                          */
/* ------------------------------------------------------------------------------------------------ */

export const ARTICLE_SLUGS = [
  'what-is-geo',
  'ai-crawlers-robots-txt',
  'llms-txt',
  'json-ld-for-ai',
  'javascript-and-ai-crawlers',
  'writing-quotable-content',
  'seo-basics-for-ai-search',
  'measuring-ai-traffic',
  'astro-llms-txt-json-ld',
  'geo-checklist',
] as const;
export type ArticleSlug = (typeof ARTICLE_SLUGS)[number];

/** Which article explains each check. */
export const LEARN_MORE: Record<string, ArticleSlug> = {
  'ai-search-bots': 'ai-crawlers-robots-txt',
  'ai-training-bots': 'ai-crawlers-robots-txt',
  'robots-txt': 'ai-crawlers-robots-txt',
  'firewall-probe': 'ai-crawlers-robots-txt',
  'indexing-directives': 'ai-crawlers-robots-txt',
  'llms-txt': 'llms-txt',
  'llms-full-txt': 'llms-txt',
  'server-rendered-text': 'javascript-and-ai-crawlers',
  'single-h1': 'writing-quotable-content',
  'heading-order': 'writing-quotable-content',
  'img-alt': 'writing-quotable-content',
  lang: 'writing-quotable-content',
  freshness: 'writing-quotable-content',
  authorship: 'writing-quotable-content',
  'jsonld-present': 'json-ld-for-ai',
  'jsonld-types': 'json-ld-for-ai',
  'jsonld-fields': 'json-ld-for-ai',
  'microdata-rdfa': 'json-ld-for-ai',
  'interactive-names': 'geo-checklist',
  'webmcp-declarative': 'geo-checklist',
  'http-status': 'seo-basics-for-ai-search',
  https: 'seo-basics-for-ai-search',
  redirects: 'seo-basics-for-ai-search',
  title: 'seo-basics-for-ai-search',
  'meta-description': 'seo-basics-for-ai-search',
  canonical: 'seo-basics-for-ai-search',
  'open-graph': 'seo-basics-for-ai-search',
  'twitter-card': 'seo-basics-for-ai-search',
  sitemap: 'seo-basics-for-ai-search',
  viewport: 'seo-basics-for-ai-search',
};

/* ------------------------------------------------------------------------------------------------ */
/* Who can see you                                                                                  */
/* ------------------------------------------------------------------------------------------------ */

export type ProductVisibility = ProductStatus;
export { PRODUCTS, type Visibility };

/** Per-product status; the same data the ai-search-bots score and the score cap use. */
export function visibility(ctx: CheckContext): ProductVisibility[] {
  return productStatuses(ctx);
}

/* ------------------------------------------------------------------------------------------------ */
/* Action plan                                                                                      */
/* ------------------------------------------------------------------------------------------------ */

export type Effort = 'minutes' | 'hours' | 'project';

/** Conservative effort estimates per check, for a typical site. Estimates, not promises. */
export const EFFORT: Record<string, Effort> = {
  'ai-search-bots': 'minutes',
  // Never a quick win: allowing training crawlers is a choice, not a fix.
  'ai-training-bots': 'hours',
  'robots-txt': 'minutes',
  'firewall-probe': 'hours',
  'indexing-directives': 'minutes',
  'llms-txt': 'hours',
  'llms-full-txt': 'hours',
  'interactive-names': 'hours',
  'server-rendered-text': 'project',
  'single-h1': 'minutes',
  'heading-order': 'hours',
  'img-alt': 'hours',
  lang: 'minutes',
  freshness: 'hours',
  authorship: 'hours',
  'jsonld-present': 'hours',
  'jsonld-types': 'hours',
  'jsonld-fields': 'hours',
  'http-status': 'hours',
  https: 'hours',
  redirects: 'hours',
  title: 'minutes',
  'meta-description': 'minutes',
  canonical: 'minutes',
  'open-graph': 'hours',
  'twitter-card': 'minutes',
  sitemap: 'hours',
  viewport: 'minutes',
};

const NOTE: Record<string, string> = { 'ai-training-bots': 'Only if you want models to learn from the site' };

export const EFFORT_LABEL: Record<Effort, string> = { minutes: 'about 15 min', hours: '1–4 hours', project: 'days' };
const EFFORT_COST: Record<Effort, number> = { minutes: 1, hours: 4, project: 16 };

export interface ActionItem {
  id: string;
  title: string;
  summary: string;
  status: CheckResult['status'];
  category: CheckResult['category'];
  /** Overall points this fix can add (0..100 scale). */
  points: number;
  effort: Effort;
  effortLabel: string;
  learnMore?: ArticleSlug;
  /** A caveat shown with the item, e.g. "Only if you want models to learn from the site". */
  note?: string;
}

export interface ActionPlan {
  quickWins: ActionItem[];
  thisWeek: ActionItem[];
  bigger: ActionItem[];
  /** Agent readiness items: not scored, never quick wins, not in the projections. */
  optional: ActionItem[];
  current: number;
  /** Score if every quick win passed (an upper bound). */
  afterQuickWins: number;
  /** Score if everything in the plan passed. */
  afterAll: number;
}

/** Overall score if the `fixed` checks passed, with the cap re-evaluated after those fixes. */
function scoreIf(categories: CategoryResult[], fixed: ReadonlySet<string>, cap?: CapInput): number {
  const raw = overallScore(
    categories.map((c) => ({
      weight: c.weight,
      score: categoryScore(c.checks.map((x) => (fixed.has(x.id) ? { ...x, score: 1 } : x))),
    })),
  );
  const limit = cap ? scoreCap(cap, fixed)?.limit : undefined;
  return limit === undefined ? raw : Math.min(raw, limit);
}

export function actionPlan(categories: CategoryResult[], cap?: CapInput): ActionPlan {
  const current = scoreIf(categories, new Set(), cap);
  const toItem = (c: CheckResult, points: number): ActionItem => {
    const effort = EFFORT[c.id] ?? 'hours';
    return {
      id: c.id,
      title: c.title,
      summary: c.summary,
      status: c.status,
      category: c.category,
      points,
      effort,
      effortLabel: EFFORT_LABEL[effort],
      learnMore: LEARN_MORE[c.id],
      ...(NOTE[c.id] ? { note: NOTE[c.id] } : {}),
    };
  };
  const optional = categories
    .filter((c) => !isScored(c))
    .flatMap((c) => c.checks)
    .filter((c) => c.status === 'warn' || c.status === 'fail' || (c.status === 'info' && c.fix))
    .map((c) => toItem(c, 0));
  const items: ActionItem[] = categories
    .filter(isScored)
    .flatMap((c) => c.checks)
    .filter((c) => (c.status === 'fail' || c.status === 'warn') && c.weight > 0)
    // Raw points, or more when the fix also lifts the cap (unblocking a major product).
    .map((c) => toItem(c, Math.round(Math.max(impact(c, categories), scoreIf(categories, new Set([c.id]), cap) - current) * 10) / 10))
    .filter((i) => i.points > 0)
    // Score gain per unit of effort, then raw gain.
    .sort((a, b) => b.points / EFFORT_COST[b.effort] - a.points / EFFORT_COST[a.effort] || b.points - a.points);

  const quickWins = items.filter((i) => i.effort === 'minutes');
  return {
    quickWins,
    thisWeek: items.filter((i) => i.effort === 'hours'),
    bigger: items.filter((i) => i.effort === 'project'),
    optional,
    current,
    afterQuickWins: Math.max(current, scoreIf(categories, new Set(quickWins.map((i) => i.id)), cap)),
    afterAll: Math.max(current, scoreIf(categories, new Set(items.map((i) => i.id)), cap)),
  };
}

/* ------------------------------------------------------------------------------------------------ */
/* Strengths                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

const STRENGTH: Record<string, string> = {
  'ai-search-bots': 'Every AI search and assistant crawler is allowed in',
  'indexing-directives': 'Nothing stops search engines indexing or quoting the page',
  'firewall-probe': 'Test requests as AI crawlers got the same page as a normal visitor',
  'llms-txt': 'llms.txt gives agents and tools a map of the site',
  'llms-full-txt': 'llms-full.txt offers the content as clean Markdown',
  'ai-training-bots': 'Models can learn about the site from every major training crawler',
  'server-rendered-text': 'The content is in the HTML, readable without JavaScript',
  'single-h1': 'One clear H1 states what the page is about',
  'heading-order': 'Headings form a clean outline assistants can split into sections',
  'img-alt': 'Images are described with alt text',
  freshness: 'The page shows when it was published or updated',
  authorship: 'It is clear who is behind the content',
  'jsonld-present': 'JSON-LD structured data is present and valid',
  'jsonld-types': 'Structured data says who runs the site and what the page is',
  'jsonld-fields': 'Structured data has the key fields filled in',
  sitemap: 'An XML sitemap is published and referenced in robots.txt',
  'meta-description': 'A meta description of good length gives a ready-made summary',
  title: 'The title is descriptive and the right length',
  canonical: 'A canonical URL removes doubt about which address to cite',
  'open-graph': 'Open Graph tags make shared links look right',
};
const STRENGTH_ORDER = Object.keys(STRENGTH);

/** Content strengths that mean nothing when the content is not in the HTML in the first place. */
const CONTENT_STRENGTHS = ['single-h1', 'heading-order', 'img-alt'];

export function strengths(categories: CategoryResult[], limit = 6): string[] {
  const checks = categories.flatMap((c) => c.checks);
  const shell = checks.find((c) => c.id === 'server-rendered-text')?.status === 'fail';
  // Only real passes: not vacuous (nothing to check), not with caveats.
  const passing = new Set(checks.filter((c) => c.status === 'pass' && !c.vacuous && !c.notes?.length).map((c) => c.id));
  return STRENGTH_ORDER.filter((id) => passing.has(id) && !(shell && CONTENT_STRENGTHS.includes(id)))
    .slice(0, limit)
    .map((id) => STRENGTH[id]!);
}

/* ------------------------------------------------------------------------------------------------ */
/* Summary                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

/** How the biggest gap reads in a sentence, by check id. */
const GAP: Record<string, string> = {
  'ai-search-bots': 'robots.txt keeps some AI search crawlers out, so those assistants cannot cite the page',
  'indexing-directives': 'robots directives (noindex or nosnippet) stop search engines from showing or quoting the page',
  'llms-txt': 'there is no usable llms.txt to point assistants at the most important pages',
  'llms-full-txt': 'there is no llms-full.txt with the content as clean Markdown',
  'robots-txt': 'robots.txt is missing or broken, which leaves crawlers without clear rules or a sitemap hint',
  'firewall-probe': 'a firewall or bot rule seems to block AI crawlers that robots.txt allows',
  'ai-training-bots': 'some AI training crawlers are blocked, so models learn less about the brand',
  'server-rendered-text': 'the content only appears after JavaScript runs, so most AI crawlers see an almost empty page',
  'single-h1': 'the page has no single clear H1 saying what it is about',
  'heading-order': 'the heading outline is hard to follow',
  'img-alt': 'many images have no alt text',
  lang: 'the page language is not declared',
  freshness: 'nothing shows when the content was published or last updated',
  authorship: 'nothing names the author or organisation behind the content',
  'jsonld-present': 'there is no valid JSON-LD telling assistants who runs the site and what the page is',
  'jsonld-types': 'the structured data does not say who runs the site or what the page is',
  'jsonld-fields': 'the structured data misses key fields',
  'http-status': 'the page does not return a normal 200 response',
  https: 'the page is not served over HTTPS',
  redirects: 'the URL goes through a chain of redirects',
  title: 'the title tag needs work',
  'meta-description': 'the meta description is missing or the wrong length',
  canonical: 'the canonical URL is missing or points elsewhere',
  'open-graph': 'Open Graph tags are incomplete',
  'twitter-card': 'there is no X/Twitter card',
  sitemap: 'no XML sitemap was found',
  viewport: 'the page has no mobile viewport',
};

const CATEGORY_NAME: Record<string, string> = {
  'ai-access': 'AI access',
  content: 'AI-readable content',
  'structured-data': 'structured data',
  seo: 'SEO basics',
};

const SHORT: Record<string, string> = {
  'chatgpt-search': 'ChatGPT search',
  claude: 'Claude',
  perplexity: 'Perplexity',
  google: "Google's AI Overviews",
  copilot: 'Microsoft Copilot',
  apple: 'Siri',
};

export function summary(input: {
  domain: string;
  score: number;
  categories: CategoryResult[];
  visibility: ProductVisibility[];
  plan: ActionPlan;
  cap?: ScoreCap | null;
  rawScore?: number;
}): string {
  const { domain, score, categories, visibility: vis, plan, cap } = input;
  const out: string[] = [];

  const answers = vis.filter((v) => v.kind === 'answers' && SHORT[v.id]);
  const visible = answers.filter((v) => v.answers === 'visible').map((v) => SHORT[v.id]!);
  const partly = answers.filter((v) => v.answers === 'partly');
  const blocked = answers.filter((v) => v.answers === 'blocked');
  const shutOut = blocked.length >= 2;

  const raw = input.rawScore ?? score;
  if (cap && raw >= 70) {
    // The page is fine; access is what holds the score down.
    out.push(
      `${domain} scores ${score}/100: the page itself is in ${raw >= 90 ? 'very good' : 'decent'} shape, but ${shutOut ? 'several AI assistants are kept out' : 'not every AI assistant is let in'}.`,
    );
  } else if (score >= 90) {
    out.push(
      blocked.length
        ? `${domain} scores ${score}/100: the page itself is in very good shape, but not every AI assistant is let in.`
        : `${domain} scores ${score}/100: it is well prepared to be found, read and cited by AI assistants.`,
    );
  } else if (score >= 70) {
    out.push(
      shutOut
        ? `${domain} scores ${score}/100: the page itself is in decent shape, but several AI assistants are kept out.`
        : `${domain} scores ${score}/100: AI assistants can use most of it, but a few gaps make it less likely to be cited.`,
    );
  } else if (score >= 55) out.push(`${domain} scores ${score}/100: there are significant gaps that make AI assistants likely to skip or misread it.`);
  else out.push(`${domain} scores ${score}/100: right now most AI assistants will struggle to find or understand it.`);

  if (cap) {
    out.push(`The score is capped at ${cap.limit} because ${cap.reasons.join(', and ')}; without the cap it would be ${input.rawScore ?? score}.`);
  }

  if (!partly.length && !blocked.length) {
    out.push(`${list(answers.map((v) => SHORT[v.id]!))} can all reach and read the page.`);
  } else {
    const parts: string[] = [];
    if (visible.length) parts.push(`${list(visible)} can reach and read the page`);
    if (blocked.length) parts.push(`${list(blocked.map((v) => SHORT[v.id]!))} ${blocked.length === 1 ? 'is' : 'are'} shut out`);
    if (partly.length) parts.push(`${list(partly.map((v) => SHORT[v.id]!))} only partly ${partly.length === 1 ? 'gets' : 'get'} through`);
    const sentence = parts.length === 3 ? `${parts[0]}, ${parts[1]}, and ${parts[2]}` : parts.join(visible.length ? ', but ' : ', and ');
    out.push(`${capitalise(sentence)}.`);
  }

  const gaps = [...plan.quickWins, ...plan.thisWeek, ...plan.bigger].sort((a, b) => b.points - a.points);
  const top = gaps[0];
  const topCat = top ? categories.find((c) => c.id === top.category) : undefined;
  if (!top) {
    out.push('There is nothing significant left to fix; keep content dated and up to date so assistants keep trusting it.');
  } else if (top.points >= 3) {
    out.push(`The biggest gap is that ${GAP[top.id] ?? top.title.toLowerCase()}${topCat && topCat.score < 60 ? `, which holds ${CATEGORY_NAME[topCat.id]} at ${topCat.score}/100` : ''}.`);
  } else {
    out.push(`What is left is polish: ${GAP[top.id] ?? top.title.toLowerCase()}.`);
  }

  const gain = plan.afterQuickWins - plan.current;
  if (plan.quickWins.length && gain >= 2) {
    out.push(
      `The ${plan.quickWins.length === 1 ? 'quick win' : `${plan.quickWins.length} quick wins`} in the action plan could lift the score to about ${plan.afterQuickWins}${plan.afterAll - plan.afterQuickWins >= 3 ? `, and the full plan up to ${plan.afterAll}` : ''}.`,
    );
  } else if (plan.afterAll - plan.current >= 3) {
    out.push(`Working through the action plan could lift the score up to ${plan.afterAll}.`);
  }
  return out.join(' ');
}

/* ------------------------------------------------------------------------------------------------ */

export interface Insights {
  summary: string;
  visibility: ProductVisibility[];
  plan: ActionPlan;
  strengths: string[];
}

export function buildInsights(
  ctx: CheckContext,
  domain: string,
  categories: CategoryResult[],
  scoring?: { score: number; rawScore: number; cap: ScoreCap | null; capInput: CapInput },
): Insights {
  const vis = visibility(ctx);
  const plan = actionPlan(categories, scoring?.capInput);
  return {
    summary: summary({ domain, score: scoring?.score ?? overallScore(categories), categories, visibility: vis, plan, cap: scoring?.cap ?? null, rawScore: scoring?.rawScore }),
    visibility: vis,
    plan,
    strengths: strengths(categories),
  };
}
