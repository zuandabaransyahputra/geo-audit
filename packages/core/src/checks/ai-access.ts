import { AI_BOTS, type Bot } from '../bots';
import { isAllowed } from '../robots';
import type { CheckResult, Status } from '../types';
import { plural, result, type CheckContext, type Spec } from './shared';

export function botVerdicts(ctx: CheckContext, bots: Bot[]) {
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

function robotsAllowSnippet(ctx: CheckContext, bots: Bot[]): string {
  const sitemap = ctx.robots?.sitemaps[0] ?? `${ctx.url.origin}/sitemap.xml`;
  return [...bots.map((b) => `User-agent: ${b.token}`), 'Allow: /', '', `Sitemap: ${sitemap}`].join('\n');
}

export function checkAiSearchBots(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'ai-search-bots',
    category: 'ai-access',
    title: 'AI search and assistant crawlers can reach the page',
    weight: 5,
    why: 'ChatGPT, Claude, Perplexity and Google AI Overviews can only cite pages their crawlers are allowed to fetch.',
  };
  const bots = AI_BOTS.filter((b) => b.purpose !== 'training');
  const verdicts = botVerdicts(ctx, bots);
  const blocked = verdicts.filter((v) => !v.allowed);
  const details = verdicts.map((v) => `${v.allowed ? 'allowed' : 'BLOCKED'}  ${v.bot.token} (${v.bot.role})${!v.allowed && v.reason ? `: ${v.reason}` : ''}`);
  if (!blocked.length) {
    return result(spec, 'pass', `All ${bots.length} search and assistant crawlers are allowed${ctx.robots ? '' : ' (no robots.txt rules apply)'}.`, { details });
  }
  const score = 1 - blocked.length / bots.length;
  const core = blocked.some((v) => v.bot.token === 'Googlebot' || v.bot.token === 'Bingbot');
  const status: Status = core || score < 0.5 ? 'fail' : 'warn';
  return result(
    spec,
    status,
    `${plural(blocked.length, 'crawler')} blocked: ${blocked.map((v) => v.bot.token).join(', ')}.`,
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
  const bots = AI_BOTS.filter((b) => b.purpose === 'training');
  const verdicts = botVerdicts(ctx, bots);
  const blocked = verdicts.filter((v) => !v.allowed);
  const details = verdicts.map((v) => `${v.allowed ? 'allowed' : 'blocked'}  ${v.bot.token} (${v.bot.role})${!v.allowed && v.reason ? `: ${v.reason}` : ''}`);
  if (!blocked.length) return result(spec, 'pass', `All ${bots.length} training crawlers are allowed.`, { details });
  return result(
    spec,
    'warn',
    `${blocked.length} of ${bots.length} training crawlers are blocked: ${blocked.map((v) => v.bot.token).join(', ')}. Fine if that is deliberate.`,
    {
      details,
      fix: {
        text: 'If you want models to know your brand and content, allow these crawlers. Keep them blocked if you opted out on purpose.',
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
      return result(spec, 'pass', `robots.txt found: ${plural(groups, 'group')}, ${plural(r.sitemaps.length, 'sitemap')} referenced.`);
    }
  }
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
  return result(spec, 'pass', found.length ? 'Robots directives allow indexing and snippets.' : 'No noindex or nosnippet directives.');
}
