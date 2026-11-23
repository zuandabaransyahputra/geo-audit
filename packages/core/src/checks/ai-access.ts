import { AI_BOTS, SCORED_BOTS, type Bot } from '../bots';
import { botVerdicts, directivesFor, list, productStatuses } from '../products';
import { globalContentSignals } from '../robots';
import type { CheckResult, Status } from '../types';
import { plural, result, type CheckContext, type Spec } from './shared';

function robotsAllowSnippet(ctx: CheckContext, bots: Bot[]): string {
  const sitemap = ctx.robots?.sitemaps[0] ?? `${ctx.url.origin}/sitemap.xml`;
  return [...bots.map((b) => `User-agent: ${b.token}`), 'Allow: /', '', `Sitemap: ${sitemap}`].join('\n');
}

const TIER_WEIGHT = { major: 1, other: 0.5 } as const;
const VALUE = { visible: 1, 'opted-out': 1, partly: 0.5, blocked: 0 } as const;

export function checkAiSearchBots(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'ai-search-bots',
    category: 'ai-access',
    title: 'AI search and assistant crawlers can reach the page',
    weight: 5,
    why: 'ChatGPT, Claude, Perplexity and Google AI Overviews can only cite pages their crawlers are allowed to fetch.',
  };
  const bots = SCORED_BOTS().filter((b) => b.purpose !== 'training');
  const verdicts = botVerdicts(ctx, bots);
  const blocked = verdicts.filter((v) => !v.allowed);
  const details = verdicts.map(
    (v) => `${v.allowed ? 'allowed' : 'BLOCKED'}  ${v.bot.token} (${v.bot.role}${v.bot.robotsTxt === 'may-ignore' ? '; may ignore robots.txt' : ''})${!v.allowed && v.reason ? `: ${v.reason}` : ''}`,
  );
  // Crawlers that generally ignore robots.txt are listed for information, never scored.
  for (const v of botVerdicts(ctx, AI_BOTS.filter((b) => b.scored === false))) {
    details.push(`info  ${v.bot.token} (${v.bot.role}; generally ignores robots.txt, not scored)${!v.allowed ? ': robots.txt blocks it' : ''}`);
  }
  if (!blocked.length) {
    // Content signals limit use without blocking crawling; worth a note, not a deduction.
    const signals = ctx.robots ? globalContentSignals(ctx.robots) : null;
    const limits = Object.entries(signals ?? {}).filter(([k, v]) => (k === 'search' || k === 'ai-input') && v === 'no');
    const notes = limits.map(([k]) => `robots.txt sets \`Content-Signal: ${k}=no\`: crawlers may fetch the page, but you ask them not to use it ${k === 'search' ? 'in search results' : 'as input for AI answers'}.`);
    return result(spec, 'pass', `All ${bots.length} search and assistant crawlers are allowed${ctx.robots ? '' : ' (no robots.txt rules apply)'}.`, { details, ...(notes.length ? { notes } : {}) });
  }
  // Scored per product, so a handful of small crawlers cannot dilute a blocked major one.
  const products = productStatuses(ctx).filter((p) => p.kind === 'answers');
  const total = products.reduce((n, p) => n + TIER_WEIGHT[p.tier], 0);
  const score = total ? products.reduce((n, p) => n + TIER_WEIGHT[p.tier] * VALUE[p.robots], 0) / total : 1;
  const core = blocked.some((v) => v.bot.token === 'Googlebot' || v.bot.token === 'Bingbot');
  const status: Status = core || score < 0.5 ? 'fail' : 'warn';
  const shut = products.filter((p) => p.robots === 'blocked').map((p) => p.product);
  return result(
    spec,
    status,
    `${plural(blocked.length, 'crawler')} blocked: ${blocked.map((v) => v.bot.token).join(', ')}.${shut.length ? ` That shuts out ${list(shut)}.` : ''}`,
    {
      details,
      fix: {
        text:
          ctx.robotsState === 'server-error' || ctx.robotsState === 'error'
            ? 'Make /robots.txt return 200 (or 404 if you have no rules). A 5xx or timeout makes crawlers treat the whole site as off limits.'
            : 'Remove the Disallow rules that match these crawlers, or give them their own group that allows the site:',
        snippet: robotsAllowSnippet(ctx, blocked.map((v) => v.bot)),
        lang: 'txt',
      },
    },
    score,
  );
}

export function checkAiTrainingBots(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'ai-training-bots',
    category: 'ai-access',
    title: 'AI training crawlers',
    weight: 1,
    why: 'Training crawlers decide whether models learn about you at all; blocking them is a valid choice, but it makes you less known to assistants.',
  };
  const bots = SCORED_BOTS().filter((b) => b.purpose === 'training');
  const verdicts = botVerdicts(ctx, bots);
  const blocked = verdicts.filter((v) => !v.allowed);
  const details = verdicts.map((v) => `${v.allowed ? 'allowed' : 'blocked'}  ${v.bot.token} (${v.bot.role})${!v.allowed && v.reason ? `: ${v.reason}` : ''}`);
  if (!blocked.length) return result(spec, 'pass', `All ${bots.length} training crawlers are allowed.`, { details });
  if (ctx.trainingOptOut) {
    const why = ctx.trainingOptOutSource === 'content-signal' ? ' robots.txt says `Content-Signal: ai-train=no`.' : '';
    return result(spec, 'info', `Training crawlers are blocked on purpose, so this does not count against the score.${why}`, { details }, 1);
  }
  return result(
    spec,
    'warn',
    `${blocked.length} of ${bots.length} training crawlers are blocked: ${blocked.map((v) => v.bot.token).join(', ')}. Fine if that is deliberate.`,
    {
      details,
      fix: {
        text: 'Only if you want models to learn from the site: allow these crawlers. If you block them on purpose, mark the opt-out and it stops counting.',
        snippet: robotsAllowSnippet(ctx, blocked.map((v) => v.bot)),
        lang: 'txt',
      },
    },
    1 - blocked.length / bots.length,
  );
}

export function checkRobotsTxt(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'robots-txt',
    category: 'ai-access',
    title: 'robots.txt is present and valid',
    weight: 1,
    why: 'robots.txt is the first file every crawler reads; it sets the rules and points to your sitemap.',
  };
  const sample = [`User-agent: *`, `Allow: /`, ``, `Sitemap: ${ctx.url.origin}/sitemap.xml`].join('\n');
  switch (ctx.robotsState) {
    case 'missing':
      return result(spec, 'warn', 'No robots.txt (404). Everything is allowed, but crawlers get no sitemap hint.', {
        fix: { text: `Add ${ctx.url.origin}/robots.txt:`, snippet: sample, lang: 'txt' },
      });
    case 'html':
      return result(spec, 'warn', '/robots.txt returns an HTML page instead of a text file.', {
        fix: { text: 'Serve a plain-text robots.txt from the site root (SPA fallbacks often answer every path with index.html).', snippet: sample, lang: 'txt' },
      });
    case 'server-error':
    case 'error': {
      const err = ctx.inputs.robots.ok ? `HTTP ${ctx.inputs.robots.res.status}` : ctx.inputs.robots.error;
      return result(spec, 'fail', `robots.txt could not be fetched (${err}). Crawlers treat that as "keep out".`, {
        fix: { text: 'Make /robots.txt return 200 with your rules, or 404 if you have none.', snippet: sample, lang: 'txt' },
      });
    }
    default: {
      const r = ctx.robots!;
      const groups = r.groups.length;
      if (r.invalidLines.length) {
        return result(spec, 'warn', `robots.txt parses with ${plural(r.invalidLines.length, 'unrecognised line')} (line ${r.invalidLines.slice(0, 5).join(', ')}).`, {
          fix: { text: 'Every line should be `Field: value` (User-agent, Allow, Disallow, Sitemap), and rules must come after a User-agent line.' },
        });
      }
      const signals = r.contentSignals.map(
        (c) => `Content-Signal (${c.agents.length ? c.agents.map((a) => `User-agent: ${a}`).join(', ') : 'all crawlers'}, line ${c.line}): ${Object.entries(c.signals).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      );
      return result(spec, 'pass', `robots.txt found: ${plural(groups, 'group')}, ${plural(r.sitemaps.length, 'sitemap')} referenced${signals.length ? `, ${plural(signals.length, 'Content-Signal line')}` : ''}.`, signals.length ? { details: signals } : {});
    }
  }
}

export function checkIndexing(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'indexing-directives',
    category: 'ai-access',
    title: 'Page may be indexed and quoted',
    weight: 4,
    why: 'A noindex or nosnippet directive keeps the page out of search and AI answers even when crawling is allowed.',
  };
  const found = directivesFor(ctx);
  const hard: string[] = [];
  const soft: string[] = [];
  for (const { source, directives } of found) {
    for (const d of directives) {
      if (d === 'noindex' || d === 'none') hard.push(`${d} in ${source}`);
      else if (d === 'nosnippet' || d === 'max-snippet:0' || d === 'noai' || d === 'noimageai') soft.push(`${d} in ${source}`);
    }
  }
  if (hard.length) {
    return result(spec, 'fail', `The page is marked ${hard.join('; ')}.`, {
      fix: {
        text: 'Remove noindex from pages you want found. If it comes from a header, check your server or CDN config.',
        snippet: '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
        lang: 'html',
      },
    });
  }
  if (soft.length) {
    return result(spec, 'warn', `Limits on quoting: ${soft.join('; ')}.`, {
      fix: {
        text: 'nosnippet and max-snippet:0 stop Google from quoting the page, including in AI Overviews; noai is a non-standard opt-out. Drop them unless you mean it.',
        snippet: '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
        lang: 'html',
      },
    });
  }
  const limited = found.flatMap(({ source, directives }) => directives.filter((d) => /^max-snippet:\d+$/.test(d) && d !== 'max-snippet:0').map((d) => `${d} in ${source}`));
  const notes = limited.map((d) => `${d} limits how much text Google may quote, including in AI Overviews.`);
  return result(spec, 'pass', found.length ? 'Robots directives allow indexing and snippets.' : 'No noindex or nosnippet directives.', notes.length ? { notes } : {});
}

export { botVerdicts, directivesFor };

export function checkFirewallProbe(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'firewall-probe',
    category: 'ai-access',
    title: 'AI crawlers get the same page as everyone else',
    weight: 3,
    why: 'A CDN or firewall bot rule can block AI crawlers that robots.txt allows; the crawler then sees an error or a challenge page instead of your content.',
  };
  const probes = ctx.probes;
  const status = ctx.inputs.page.status;
  if (!probes.length) {
    const why = status < 200 || status >= 300 ? `the page itself returned HTTP ${status}` : 'robots.txt allows none of the crawlers we probe';
    return result(spec, 'info', `No probes ran: ${why}.`, { vacuous: true });
  }
  const details = probes.map((p) => `${p.verdict === 'ok' ? 'ok' : p.verdict.toUpperCase()}  ${p.token}: ${p.detail}${p.words !== undefined && p.verdict === 'ok' ? `, ${p.words.toLocaleString('en-US')} words` : ''}`);
  const bad = probes.filter((p) => p.verdict !== 'ok');
  if (!bad.length) {
    return result(spec, 'pass', `Requests as ${list(probes.map((p) => p.token))} got the same page as a normal request (HTTP ${status}).`, { details });
  }
  const what = bad.map((p) => `${p.token} ${p.detail}`);
  const errorsOnly = bad.every((p) => p.verdict === 'error');
  const summary = errorsOnly
    ? `${list(what)}, while a normal request got ${status}. That may be a network issue or a firewall dropping the request; confirm this in your CDN logs.`
    : `${list(what)} while a normal request got ${status}. A firewall or bot rule likely blocks ${bad.length === 1 ? 'it' : 'them'}. Real crawlers are also verified by IP, so confirm this in your CDN logs.`;
  return result(
    spec,
    'warn',
    summary,
    {
      details,
      fix: {
        text: 'Check the bot rules in front of the site. In Cloudflare, review the AI crawler and bot settings and any WAF custom rules; in Vercel, review Firewall rules and bot protection; on other WAFs, allowlist these crawlers by user agent and the IP ranges their vendors publish. Requests from this tool carry `GEO-Audit-probe` in the user agent, so you can find them in your logs.',
      },
    },
    (probes.length - bad.length) / probes.length,
  );
}
