/**
 * Rule-based insights on top of the check results: a plain-language summary, which AI products can see
 * the page, an action plan ordered by points per effort, and strengths. No AI API involved: every
 * sentence comes from a template and the same data the checks used, so it can never contradict them.
 */
import { AI_BOTS } from './bots';
import { botVerdicts, directivesFor, type CheckContext } from './checks';
import { categoryScore, impact, overallScore } from './score';
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

export type Visibility = 'visible' | 'partly' | 'blocked';

export interface ProductVisibility {
  id: string;
  product: string;
  /** What being visible here means. */
  role: string;
  /** training = the product only learns from you; answers = it can cite and link you. */
  kind: 'answers' | 'training';
  status: Visibility;
  /**
   * Status for being found and cited, ignoring training-only opt-outs (Google-Extended, Applebot-Extended,
   * ClaudeBot, Perplexity-User aside). Same as `status` for training products.
   */
  answers: Visibility;
  /** One sentence explaining the status. */
  reason: string;
  crawlers: { token: string; allowed: boolean; primary: boolean }[];
  docs: string;
}

interface ProductSpec {
  id: string;
  product: string;
  role: string;
  kind: 'answers' | 'training';
  /** Blocking any of these blocks the product. */
  primary: string[];
  /** Blocking these makes it "partly". */
  secondary: string[];
  docs: string;
  /** Respects noindex as a hard stop (documented). */
  noindexBlocks?: boolean;
  /** Respects nosnippet / max-snippet:0 for its answers (documented). */
  nosnippetLimits?: boolean;
  /** Renders JavaScript, so a client-side app shell is less of a problem. */
  rendersJs?: boolean;
}

export const PRODUCTS: ProductSpec[] = [
  {
    id: 'chatgpt-search',
    product: 'ChatGPT search',
    role: 'Shown and linked in ChatGPT search answers',
    kind: 'answers',
    primary: ['OAI-SearchBot'],
    secondary: ['ChatGPT-User'],
    docs: 'https://developers.openai.com/api/docs/bots',
  },
  {
    id: 'chatgpt-training',
    product: 'ChatGPT training',
    role: 'Used to train OpenAI models',
    kind: 'training',
    primary: ['GPTBot'],
    secondary: [],
    docs: 'https://developers.openai.com/api/docs/bots',
  },
  {
    id: 'claude',
    product: 'Claude',
    role: 'Found by Claude search, fetched when users ask, used for training',
    kind: 'answers',
    primary: ['Claude-SearchBot'],
    secondary: ['Claude-User', 'ClaudeBot'],
    docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'perplexity',
    product: 'Perplexity',
    role: 'Shown and cited in Perplexity answers',
    kind: 'answers',
    primary: ['PerplexityBot'],
    secondary: ['Perplexity-User'],
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    id: 'google',
    product: 'Google AI Overviews & Gemini',
    role: 'AI Overviews and AI Mode in Search; Gemini training and grounding',
    kind: 'answers',
    primary: ['Googlebot'],
    secondary: ['Google-Extended'],
    docs: 'https://developers.google.com/search/docs/appearance/ai-features',
    noindexBlocks: true,
    nosnippetLimits: true,
    rendersJs: true,
  },
  {
    id: 'copilot',
    product: 'Microsoft Copilot & Bing',
    role: 'Bing search results and answers in Copilot',
    kind: 'answers',
    primary: ['Bingbot'],
    secondary: [],
    docs: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0',
    noindexBlocks: true,
  },
  {
    id: 'apple',
    product: 'Apple Intelligence & Siri',
    role: 'Siri, Spotlight and Safari suggestions; Apple model training',
    kind: 'answers',
    primary: ['Applebot'],
    secondary: ['Applebot-Extended'],
    docs: 'https://support.apple.com/en-us/119829',
    nosnippetLimits: true,
  },
  {
    id: 'others',
    product: 'Common Crawl & other model builders',
    role: 'Open web datasets and model training (Common Crawl, ByteDance, Meta)',
    kind: 'training',
    primary: [],
    secondary: ['CCBot', 'Bytespider', 'meta-externalagent'],
    docs: 'https://commoncrawl.org/ccbot',
  },
];

const RANK: Record<Visibility, number> = { visible: 0, partly: 1, blocked: 2 };
const worse = (a: Visibility, b: Visibility): Visibility => (RANK[b] > RANK[a] ? b : a);

export function visibility(ctx: CheckContext, checks: CheckResult[]): ProductVisibility[] {
  const verdicts = new Map(botVerdicts(ctx, AI_BOTS).map((v) => [v.bot.token, v.allowed]));
  const allowed = (token: string) => verdicts.get(token) ?? true;
  const byId = new Map(checks.map((c) => [c.id, c]));
  const directives = directivesFor(ctx).flatMap((d) => d.directives);
  const noindex = directives.some((d) => d === 'noindex' || d === 'none');
  const nosnippet = directives.some((d) => d === 'nosnippet' || d === 'max-snippet:0');
  const jsOnly = byId.get('server-rendered-text')?.status === 'fail';
  const status = ctx.inputs.page.status;
  const gone = status === 404 || status === 410;
  const errorStatus = !gone && (status < 200 || status >= 300);

  return PRODUCTS.map((p) => {
    const crawlers = [
      ...p.primary.map((token) => ({ token, allowed: allowed(token), primary: true })),
      ...p.secondary.map((token) => ({ token, allowed: allowed(token), primary: false })),
    ];
    const trainingOnly = (token: string) => AI_BOTS.find((b) => b.token === token)?.purpose === 'training';
    let st: Visibility = 'visible';
    let ans: Visibility = 'visible';
    const both = (v: Visibility, answersToo = true) => {
      st = worse(st, v);
      if (answersToo) ans = worse(ans, v);
    };
    const reasons: string[] = [];
    const blocked = crawlers.filter((c) => !c.allowed);

    if (blocked.length) {
      const isTraining = (c: (typeof crawlers)[number]) => p.kind === 'answers' && !c.primary && trainingOnly(c.token);
      const main = blocked.filter((c) => !isTraining(c)).map((c) => c.token);
      const training = blocked.filter(isTraining).map((c) => c.token);
      const trainingText = training.length ? `${list(training)} (training only)` : '';
      reasons.push(`robots.txt blocks ${main.length && training.length ? `${list(main)}, and ${trainingText}` : main.length ? list(main) : trainingText}`);
    }
    for (const c of blocked) {
      if (!p.primary.length) {
        // A group of equal crawlers: all blocked = blocked, some = partly.
        both(blocked.length === crawlers.length ? 'blocked' : 'partly');
      } else if (c.primary) both('blocked');
      else both('partly', p.kind === 'training' || !trainingOnly(c.token));
    }
    if (gone) {
      both('blocked');
      reasons.push(`the page returns HTTP ${status}`);
    } else if (errorStatus) {
      both('partly');
      reasons.push(`the page returned HTTP ${status} to our crawler, and AI crawlers may get the same`);
    }
    if (p.kind === 'answers' && noindex) {
      both(p.noindexBlocks ? 'blocked' : 'partly');
      reasons.push(p.noindexBlocks ? 'the page is marked noindex' : 'the page is marked noindex, which this product may honour');
    }
    if (p.kind === 'answers' && nosnippet && p.nosnippetLimits) {
      both('partly');
      reasons.push('nosnippet / max-snippet:0 stops it quoting the page');
    }
    if (jsOnly && !p.rendersJs) {
      both('partly');
      reasons.push('the text only appears after JavaScript runs, which most AI crawlers skip');
    }

    let reason: string;
    if (!reasons.length) {
      reason = p.kind === 'training' ? 'Its crawlers are allowed, so it can learn from this page.' : 'Its crawlers are allowed and the page is readable.';
    } else {
      reason = `${capitalise(reasons.join('; '))}.`;
      if (p.kind === 'answers' && ans === 'visible') reason += ' It can still find and cite the page.';
    }
    return { id: p.id, product: p.product, role: p.role, kind: p.kind, status: st, answers: ans, reason, crawlers, docs: p.docs };
  });
}

/* ------------------------------------------------------------------------------------------------ */
/* Action plan                                                                                      */
/* ------------------------------------------------------------------------------------------------ */

export type Effort = 'minutes' | 'hours' | 'project';

/** Conservative effort estimates per check, for a typical site. Estimates, not promises. */
export const EFFORT: Record<string, Effort> = {
  'ai-search-bots': 'minutes',
  'ai-training-bots': 'minutes',
  'robots-txt': 'minutes',
  'indexing-directives': 'minutes',
  'llms-txt': 'hours',
  'llms-full-txt': 'hours',
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
}

export interface ActionPlan {
  quickWins: ActionItem[];
  thisWeek: ActionItem[];
  bigger: ActionItem[];
  current: number;
  /** Score if every quick win passed (an upper bound). */
  afterQuickWins: number;
  /** Score if everything in the plan passed. */
  afterAll: number;
}

function scoreIf(categories: CategoryResult[], fixed: Set<string>): number {
  return overallScore(
    categories.map((c) => ({
      weight: c.weight,
      score: categoryScore(c.checks.map((x) => (fixed.has(x.id) ? { ...x, score: 1 } : x))),
    })),
  );
}

export function actionPlan(categories: CategoryResult[]): ActionPlan {
  const items: ActionItem[] = categories
    .flatMap((c) => c.checks)
    .filter((c) => (c.status === 'fail' || c.status === 'warn') && c.weight > 0)
    .map((c) => {
      const effort = EFFORT[c.id] ?? 'hours';
      return {
        id: c.id,
        title: c.title,
        summary: c.summary,
        status: c.status,
        category: c.category,
        points: Math.round(impact(c, categories) * 10) / 10,
        effort,
        effortLabel: EFFORT_LABEL[effort],
        learnMore: LEARN_MORE[c.id],
      };
    })
    .filter((i) => i.points > 0)
    // Score gain per unit of effort, then raw gain.
    .sort((a, b) => b.points / EFFORT_COST[b.effort] - a.points / EFFORT_COST[a.effort] || b.points - a.points);

  const quickWins = items.filter((i) => i.effort === 'minutes');
  const current = overallScore(categories);
  return {
    quickWins,
    thisWeek: items.filter((i) => i.effort === 'hours'),
    bigger: items.filter((i) => i.effort === 'project'),
    current,
    afterQuickWins: Math.max(current, scoreIf(categories, new Set(quickWins.map((i) => i.id)))),
    afterAll: Math.max(current, scoreIf(categories, new Set(items.map((i) => i.id)))),
  };
}

/* ------------------------------------------------------------------------------------------------ */
/* Strengths                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

const STRENGTH: Record<string, string> = {
  'ai-search-bots': 'Every AI search and assistant crawler is allowed in',
  'indexing-directives': 'Nothing stops search engines indexing or quoting the page',
  'llms-txt': 'A well-formed llms.txt gives assistants a map of the site',
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

export function strengths(categories: CategoryResult[], limit = 6): string[] {
  const passing = new Set(categories.flatMap((c) => c.checks).filter((c) => c.status === 'pass').map((c) => c.id));
  return STRENGTH_ORDER.filter((id) => passing.has(id)).slice(0, limit).map((id) => STRENGTH[id]!);
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

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

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

export function summary(input: { domain: string; score: number; categories: CategoryResult[]; visibility: ProductVisibility[]; plan: ActionPlan }): string {
  const { domain, score, categories, visibility: vis, plan } = input;
  const out: string[] = [];

  const answers = vis.filter((v) => v.kind === 'answers' && SHORT[v.id]);
  const visible = answers.filter((v) => v.answers === 'visible').map((v) => SHORT[v.id]!);
  const partly = answers.filter((v) => v.answers === 'partly');
  const blocked = answers.filter((v) => v.answers === 'blocked');
  const shutOut = blocked.length >= 2;

  if (score >= 90) {
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

function capitalise(s: string): string {
  // File names like robots.txt stay lower case.
  if (/^[a-z-]+\.txt\b/.test(s)) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------------------------------------ */

export interface Insights {
  summary: string;
  visibility: ProductVisibility[];
  plan: ActionPlan;
  strengths: string[];
}

export function buildInsights(ctx: CheckContext, domain: string, categories: CategoryResult[]): Insights {
  const checks = categories.flatMap((c) => c.checks);
  const vis = visibility(ctx, checks);
  const plan = actionPlan(categories);
  return {
    summary: summary({ domain, score: overallScore(categories), categories, visibility: vis, plan }),
    visibility: vis,
    plan,
    strengths: strengths(categories),
  };
}
