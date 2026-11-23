/**
 * AI products and how visible a page is to each of them. This is the one place that turns robots.txt
 * verdicts, indexing directives, rendering and page status into a per-product status. The ai-search-bots
 * score, the "Who can see you" panel and the score cap all read from `productStatuses`, so they can never
 * disagree.
 */
import { AI_BOTS, botByToken, type Bot } from './bots';
import { serverTextFails } from './checks/content';
import type { CheckContext } from './checks/shared';
import { isAllowed } from './robots';

export type Visibility = 'visible' | 'partly' | 'blocked';
export type Tier = 'major' | 'other';

export interface ProductSpec {
  id: string;
  product: string;
  role: string;
  /** training = the product only learns from you; answers = it can cite and link you. */
  kind: 'answers' | 'training';
  /** Major products weigh 1 in the ai-search-bots score and can cap the overall score; others weigh 0.5. */
  tier: Tier;
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
    tier: 'major',
    primary: ['OAI-SearchBot'],
    secondary: ['ChatGPT-User'],
    docs: 'https://developers.openai.com/api/docs/bots',
  },
  {
    id: 'claude',
    product: 'Claude',
    role: 'Found by Claude search, fetched when users ask, used for training',
    kind: 'answers',
    tier: 'major',
    primary: ['Claude-SearchBot'],
    secondary: ['Claude-User', 'ClaudeBot'],
    docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'perplexity',
    product: 'Perplexity',
    role: 'Shown and cited in Perplexity answers',
    kind: 'answers',
    tier: 'major',
    primary: ['PerplexityBot'],
    secondary: ['Perplexity-User'],
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    id: 'google',
    product: 'Google AI Overviews & Gemini',
    role: 'AI Overviews and AI Mode in Search; Gemini training and grounding',
    kind: 'answers',
    tier: 'major',
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
    tier: 'major',
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
    tier: 'major',
    primary: ['Applebot'],
    secondary: ['Applebot-Extended'],
    docs: 'https://support.apple.com/en-us/119829',
    nosnippetLimits: true,
  },
  {
    id: 'chatgpt-training',
    product: 'ChatGPT training',
    role: 'Used to train OpenAI models',
    kind: 'training',
    tier: 'other',
    primary: ['GPTBot'],
    secondary: [],
    docs: 'https://developers.openai.com/api/docs/bots',
  },
  {
    id: 'others',
    product: 'Common Crawl & other model builders',
    role: 'Open web datasets and model training (Common Crawl, ByteDance, Meta)',
    kind: 'training',
    tier: 'other',
    primary: [],
    secondary: ['CCBot', 'Bytespider', 'meta-externalagent'],
    docs: 'https://commoncrawl.org/ccbot',
  },
];

export interface CrawlerState {
  token: string;
  allowed: boolean;
  primary: boolean;
  /** Training-only crawler inside an answers product (does not affect being found and cited). */
  training: boolean;
  /** The vendor says robots.txt may not apply to it. */
  mayIgnore: boolean;
}

export interface ProductStatus {
  id: string;
  product: string;
  role: string;
  kind: 'answers' | 'training';
  tier: Tier;
  status: Visibility;
  /**
   * Status for being found and cited, ignoring training-only opt-outs (Google-Extended, Applebot-Extended,
   * ClaudeBot). Same as `status` for training products.
   */
  answers: Visibility;
  /** Robots.txt part of `answers` only: what the ai-search-bots check scores. */
  robots: Visibility;
  /** One sentence explaining the status. */
  reason: string;
  crawlers: CrawlerState[];
  /** Ids of checks whose fix would lift a `blocked` answers status. Empty unless blocked. */
  blockedBy: string[];
  /** What blocks it, as a predicate for the score cap: "blocked by robots.txt", "blocked by noindex" ... */
  blockedHow?: string;
  docs: string;
}

/* ------------------------------------------------------------------------------------------------ */

export interface BotVerdict {
  bot: Bot;
  allowed: boolean;
  reason: string;
}

export function botVerdicts(ctx: CheckContext, bots: Bot[]): BotVerdict[] {
  const path = ctx.url.pathname + ctx.url.search;
  return bots.map((bot) => {
    if (ctx.robotsState === 'server-error' || ctx.robotsState === 'error') {
      return { bot, allowed: false, reason: 'robots.txt could not be fetched, so careful crawlers stay away' };
    }
    if (!ctx.robots) return { bot, allowed: true, reason: '' };
    const v = isAllowed(ctx.robots, bot.token, path);
    const group = v.matchedAgent === '*' ? 'User-agent: *' : `User-agent: ${bot.token}`;
    const reason = v.rule ? `\`${v.rule.allow ? 'Allow' : 'Disallow'}: ${v.rule.pattern}\` (line ${v.rule.line}, ${group})` : '';
    return { bot, allowed: v.allowed, reason };
  });
}

export function directivesFor(ctx: CheckContext): { source: string; directives: string[] }[] {
  const out: { source: string; directives: string[] }[] = [];
  const split = (s: string) => s.toLowerCase().split(/\s*,\s*/).map((d) => d.trim()).filter(Boolean);
  const names = ['robots', 'googlebot', 'bingbot', ...AI_BOTS.map((b) => b.token.toLowerCase())];
  for (const n of names) {
    for (const c of ctx.page.meta.get(n) ?? []) out.push({ source: `<meta name="${n}">`, directives: split(c) });
  }
  const header = ctx.inputs.page.headers['x-robots-tag'];
  if (header) {
    // "googlebot: noindex, nofollow, otherbot: noarchive" or plain "noindex"
    let agent = '*';
    const buckets = new Map<string, string[]>();
    for (const part of header.split(',')) {
      const p = part.trim();
      const m = /^([a-z0-9_-]+)\s*:\s*(.*)$/i.exec(p);
      if (m && !/^(max-snippet|max-image-preview|max-video-preview|unavailable_after)$/i.test(m[1]!)) {
        agent = m[1]!.toLowerCase();
        if (m[2]) buckets.set(agent, [...(buckets.get(agent) ?? []), m[2].toLowerCase()]);
      } else if (p) buckets.set(agent, [...(buckets.get(agent) ?? []), p.toLowerCase()]);
    }
    for (const [a, d] of buckets) out.push({ source: `X-Robots-Tag${a === '*' ? '' : ` (${a})`}`, directives: d });
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------ */

const RANK: Record<Visibility, number> = { visible: 0, partly: 1, blocked: 2 };
const worse = (a: Visibility, b: Visibility): Visibility => (RANK[b] > RANK[a] ? b : a);

export function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function capitalise(s: string): string {
  // File names like robots.txt stay lower case.
  if (/^[a-z-]+\.txt\b/.test(s)) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const memo = new WeakMap<CheckContext, ProductStatus[]>();

/** Status of every product in `PRODUCTS` for this page. Pure; cached per context. */
export function productStatuses(ctx: CheckContext): ProductStatus[] {
  const hit = memo.get(ctx);
  if (hit) return hit;
  const verdicts = new Map(botVerdicts(ctx, AI_BOTS).map((v) => [v.bot.token, v.allowed]));
  const allowed = (token: string) => verdicts.get(token) ?? true;
  const directives = directivesFor(ctx).flatMap((d) => d.directives);
  const noindex = directives.some((d) => d === 'noindex' || d === 'none');
  const nosnippet = directives.some((d) => d === 'nosnippet' || d === 'max-snippet:0');
  const jsOnly = serverTextFails(ctx.page);
  const status = ctx.inputs.page.status;
  const gone = status === 404 || status === 410;
  const errorStatus = !gone && (status < 200 || status >= 300);
  const robotsDown = ctx.robotsState === 'server-error' || ctx.robotsState === 'error';

  const out = PRODUCTS.map((p): ProductStatus => {
    const crawlers: CrawlerState[] = [...p.primary.map((t) => [t, true] as const), ...p.secondary.map((t) => [t, false] as const)].map(([token, primary]) => {
      const bot = botByToken(token);
      return {
        token,
        allowed: allowed(token),
        primary,
        training: p.kind === 'answers' && !primary && bot?.purpose === 'training',
        mayIgnore: bot?.robotsTxt === 'may-ignore',
      };
    });
    // Mutated inside `block`; typed wide so TypeScript does not narrow them to 'visible'.
    let st = 'visible' as Visibility;
    let ans = 'visible' as Visibility;
    let rob = 'visible' as Visibility;
    const blockedBy = new Set<string>();
    let blockedHow: string | undefined;
    const block = (v: Visibility, by?: string, how?: string, opts: { answersToo?: boolean; robots?: boolean } = {}) => {
      const answersToo = opts.answersToo ?? true;
      st = worse(st, v);
      if (answersToo) ans = worse(ans, v);
      if (opts.robots && answersToo) rob = worse(rob, v);
      if (v === 'blocked' && answersToo && by) {
        blockedBy.add(by);
        blockedHow ??= how;
      }
    };
    const reasons: string[] = [];
    const blocked = crawlers.filter((c) => !c.allowed);

    if (blocked.length) {
      const main = blocked.filter((c) => !c.training).map((c) => c.token);
      const training = blocked.filter((c) => c.training).map((c) => c.token);
      const trainingText = training.length ? `${list(training)} (training only)` : '';
      if (robotsDown) reasons.push('robots.txt could not be fetched, so careful crawlers stay away');
      else reasons.push(`robots.txt blocks ${main.length && training.length ? `${list(main)}, and ${trainingText}` : main.length ? list(main) : trainingText}`);
    }
    const how = robotsDown ? 'out of reach because robots.txt could not be fetched' : 'blocked by robots.txt';
    for (const c of blocked) {
      if (!p.primary.length) {
        // A group of equal crawlers: all blocked = blocked, some = partly.
        block(blocked.length === crawlers.length ? 'blocked' : 'partly', 'ai-search-bots', how, { robots: true });
      } else if (c.primary) {
        // A crawler that may ignore robots.txt anyway only half counts.
        block(c.mayIgnore ? 'partly' : 'blocked', 'ai-search-bots', how, { robots: true });
      } else block('partly', undefined, undefined, { answersToo: !c.training, robots: true });
    }
    if (gone) {
      block('blocked', 'http-status', `out of reach because the page returns HTTP ${status}`);
      reasons.push(`the page returns HTTP ${status}`);
    } else if (errorStatus) {
      block('partly');
      reasons.push(`the page returned HTTP ${status} to our crawler, and AI crawlers may get the same`);
    }
    if (p.kind === 'answers' && noindex) {
      block(p.noindexBlocks ? 'blocked' : 'partly', 'indexing-directives', 'blocked by noindex');
      reasons.push(p.noindexBlocks ? 'the page is marked noindex' : 'the page is marked noindex, which this product may honour');
    }
    if (p.kind === 'answers' && nosnippet && p.nosnippetLimits) {
      block('partly');
      reasons.push('nosnippet / max-snippet:0 stops it quoting the page');
    }
    if (jsOnly && !p.rendersJs) {
      block('partly');
      reasons.push('the text only appears after JavaScript runs, which most AI crawlers skip');
    }

    let reason: string;
    if (!reasons.length) {
      reason = p.kind === 'training' ? 'Its crawlers are allowed, so it can learn from this page.' : 'Its crawlers are allowed and the page is readable.';
    } else {
      reason = `${capitalise(reasons.join('; '))}.`;
      if (p.kind === 'answers' && ans === 'visible') reason += ' It can still find and cite the page.';
    }
    const isBlocked = ans === 'blocked';
    return {
      id: p.id,
      product: p.product,
      role: p.role,
      kind: p.kind,
      tier: p.tier,
      status: st,
      answers: ans,
      robots: rob,
      reason,
      crawlers,
      blockedBy: isBlocked ? [...blockedBy] : [],
      ...(isBlocked && blockedHow ? { blockedHow } : {}),
      docs: p.docs,
    };
  });
  memo.set(ctx, out);
  return out;
}
