/**
 * robots.txt parser and matcher following RFC 9309 (and Google's documented behaviour where the RFC
 * leaves room): user-agent groups, merged duplicate groups, longest-match allow/disallow with `allow`
 * winning ties, `*` wildcards and a trailing `$` end anchor.
 */

export interface RobotsRule {
  allow: boolean;
  pattern: string;
  /** Pattern after percent-encoding normalisation; used for matching and length. */
  normalized: string;
  line: number;
}

export interface RobotsGroup {
  /** Lower-cased product tokens, e.g. `gptbot` or `*`. */
  agents: string[];
  rules: RobotsRule[];
  /** `Content-Signal:` values declared in this group (later lines override earlier keys). */
  contentSignals?: ContentSignalSet;
}

/** Parsed `Content-Signal: search=yes, ai-train=no` values, keys lower-cased. */
export type ContentSignalSet = Record<string, string>;

export interface ContentSignalLine {
  /** Lower-cased user agents of the group it belongs to; empty when it appears before any group. */
  agents: string[];
  signals: ContentSignalSet;
  line: number;
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
  /** Lines we could not make sense of (for diagnostics). */
  invalidLines: number[];
  /** Every `Content-Signal:` line, in file order. Not a crawl rule; reported, never scored. */
  contentSignals: ContentSignalLine[];
}

export interface RobotsVerdict {
  allowed: boolean;
  /** The rule that decided it, if any. */
  rule?: RobotsRule;
  /** Which group applied: the bot's own token, `*`, or none. */
  matchedAgent: string | null;
}

/** Google stops reading after 500 KiB; so do we. */
const MAX_ROBOTS_BYTES = 500 * 1024;

const KEY_ALIASES: Record<string, 'user-agent' | 'allow' | 'disallow' | 'sitemap' | 'content-signal' | 'other'> = {
  'content-signal': 'content-signal',
  'user-agent': 'user-agent',
  useragent: 'user-agent',
  'user agent': 'user-agent',
  allow: 'allow',
  disallow: 'disallow',
  dissallow: 'disallow',
  dissalow: 'disallow',
  disalow: 'disallow',
  'disallow:': 'disallow',
  sitemap: 'sitemap',
  'site-map': 'sitemap',
};

/** Lower-cased product token of a `User-agent:` value: `GPTBot/1.1` -> `gptbot`. */
export function agentToken(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.startsWith('*')) return '*';
  const m = /^[a-z0-9_-]+/.exec(v);
  return m ? m[0] : v;
}

export function parseRobots(text: string): ParsedRobots {
  let input = text;
  if (input.length > MAX_ROBOTS_BYTES) input = input.slice(0, MAX_ROBOTS_BYTES);
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const invalidLines: number[] = [];
  const contentSignals: ContentSignalLine[] = [];
  let current: RobotsGroup | null = null;
  // True while we are still reading consecutive user-agent lines for `current`.
  let collectingAgents = false;

  const lines = input.split(/\r\n|\r|\n/);
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const hash = raw.indexOf('#');
    const line = (hash >= 0 ? raw.slice(0, hash) : raw).trim();
    if (!line) return;
    const colon = line.indexOf(':');
    if (colon <= 0) {
      invalidLines.push(lineNo);
      return;
    }
    const key = KEY_ALIASES[line.slice(0, colon).trim().toLowerCase()] ?? 'other';
    const value = line.slice(colon + 1).trim();

    switch (key) {
      case 'user-agent': {
        if (!value) {
          invalidLines.push(lineNo);
          return;
        }
        if (!current || !collectingAgents) {
          current = { agents: [], rules: [] };
          groups.push(current);
          collectingAgents = true;
        }
        current.agents.push(agentToken(value));
        return;
      }
      case 'allow':
      case 'disallow': {
        collectingAgents = false;
        if (!current) {
          // Rules before any user-agent line belong to no group.
          invalidLines.push(lineNo);
          return;
        }
        // An empty value matches nothing (an empty `Disallow:` means "allow all").
        if (!value) return;
        const pattern = value.startsWith('/') || value.startsWith('*') ? value : `/${value}`;
        current.rules.push({ allow: key === 'allow', pattern, normalized: normalizeForMatch(pattern), line: lineNo });
        return;
      }
      case 'sitemap': {
        // Sitemap is not tied to a group and does not end the user-agent run.
        if (value) sitemaps.push(value);
        return;
      }
      case 'content-signal': {
        // A non-rule directive like crawl-delay: it ends the user-agent run, grouping is unchanged.
        if (current) collectingAgents = false;
        const signals = parseContentSignal(value);
        if (!Object.keys(signals).length) return;
        if (current) current.contentSignals = { ...current.contentSignals, ...signals };
        contentSignals.push({ agents: current ? [...current.agents] : [], signals, line: lineNo });
        return;
      }
      default: {
        // Unknown directives (crawl-delay, host, clean-param ...) end the user-agent run too.
        if (current) collectingAgents = false;
        return;
      }
    }
  });

  return { groups, sitemaps, invalidLines, contentSignals };
}

const HEX = '0123456789ABCDEF';

/**
 * Normalise a path or pattern so equivalent spellings compare equal: upper-case existing %XX escapes,
 * decode escapes of unreserved characters, percent-encode non-ASCII and spaces. `*` and `$` are kept.
 */
export function normalizeForMatch(s: string): string {
  let out = '';
  const bytes = new TextEncoder().encode(s);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === 0x25 /* % */ && i + 2 < bytes.length && isHex(bytes[i + 1]) && isHex(bytes[i + 2])) {
      const code = parseInt(String.fromCharCode(bytes[i + 1]!, bytes[i + 2]!), 16);
      const ch = String.fromCharCode(code);
      if (/[A-Za-z0-9\-._~]/.test(ch)) out += ch;
      else out += `%${HEX[code >> 4]}${HEX[code & 15]}`;
      i += 2;
    } else if (b > 0x7e || b <= 0x20) {
      out += `%${HEX[b >> 4]}${HEX[b & 15]}`;
    } else {
      out += String.fromCharCode(b);
    }
  }
  return out;
}

function isHex(b: number | undefined): boolean {
  return b !== undefined && ((b >= 48 && b <= 57) || (b >= 65 && b <= 70) || (b >= 97 && b <= 102));
}

/**
 * Does `pattern` (with `*` and optional trailing `$`) match `path` from its start?
 * Iterative glob matching: O(n*m) worst case, no regular expressions, so hostile patterns can't blow up.
 */
export function matchPattern(pattern: string, path: string): boolean {
  let p = pattern;
  let anchored = false;
  if (p.endsWith('$')) {
    anchored = true;
    p = p.slice(0, -1);
  }
  let pi = 0;
  let si = 0;
  let starP = -1;
  let starS = -1;
  while (si < path.length) {
    if (pi < p.length && p[pi] === '*') {
      starP = pi++;
      starS = si;
    } else if (pi < p.length && p[pi] === path[si]) {
      pi++;
      si++;
    } else if (pi >= p.length && !anchored) {
      // Pattern consumed and it's a prefix match.
      return true;
    } else if (starP >= 0) {
      pi = starP + 1;
      si = ++starS;
    } else {
      return false;
    }
  }
  while (pi < p.length && p[pi] === '*') pi++;
  return pi === p.length;
}

/** Rules for a bot: its own groups (merged) if any name it, otherwise the `*` groups (merged). */
export function rulesFor(robots: ParsedRobots, botToken: string): { agent: string | null; rules: RobotsRule[] } {
  const token = botToken.toLowerCase();
  const own = robots.groups.filter((g) => g.agents.includes(token));
  if (own.length) return { agent: token, rules: own.flatMap((g) => g.rules) };
  const star = robots.groups.filter((g) => g.agents.includes('*'));
  if (star.length) return { agent: '*', rules: star.flatMap((g) => g.rules) };
  return { agent: null, rules: [] };
}

/** Is `pathAndQuery` (e.g. `/blog?page=2`) allowed for `botToken`? */
export function isAllowed(robots: ParsedRobots, botToken: string, pathAndQuery: string): RobotsVerdict {
  const path = normalizeForMatch(pathAndQuery || '/');
  if (path === '/robots.txt') return { allowed: true, matchedAgent: null };
  const { agent, rules } = rulesFor(robots, botToken);
  let best: RobotsRule | undefined;
  for (const rule of rules) {
    if (!matchPattern(rule.normalized, path)) continue;
    if (
      !best ||
      rule.normalized.length > best.normalized.length ||
      (rule.normalized.length === best.normalized.length && rule.allow && !best.allow)
    ) {
      best = rule;
    }
  }
  return { allowed: best ? best.allow : true, rule: best, matchedAgent: agent };
}

/** Does this bot's group disallow the whole site (`Disallow: /` with nothing allowing `/`)? */
export function blocksEverything(robots: ParsedRobots, botToken: string): boolean {
  return !isAllowed(robots, botToken, '/').allowed && !isAllowed(robots, botToken, '/index.html').allowed;
}

/** `search=yes, ai-train=no` -> `{ search: 'yes', 'ai-train': 'no' }`. Unparseable parts are skipped. */
export function parseContentSignal(value: string): ContentSignalSet {
  const out: ContentSignalSet = {};
  for (const part of value.split(',')) {
    const m = /^\s*([a-z0-9_-]+)\s*=\s*([a-z0-9_-]+)\s*$/i.exec(part);
    if (m) out[m[1]!.toLowerCase()] = m[2]!.toLowerCase();
  }
  return out;
}

/**
 * Content signals that apply to every crawler: lines in `User-agent: *` groups, plus lines that appear
 * before any group. Null when there are none.
 */
export function globalContentSignals(robots: ParsedRobots): ContentSignalSet | null {
  const lines = robots.contentSignals.filter((c) => !c.agents.length || c.agents.includes('*'));
  if (!lines.length) return null;
  return Object.assign({}, ...lines.map((c) => c.signals)) as ContentSignalSet;
}

/** Signals for one crawler: its own groups if any name it, otherwise the global ones. */
export function contentSignalsFor(robots: ParsedRobots, botToken: string): ContentSignalSet | null {
  const token = botToken.toLowerCase();
  const own = robots.contentSignals.filter((c) => c.agents.includes(token));
  if (own.length) return Object.assign({}, ...own.map((c) => c.signals)) as ContentSignalSet;
  return globalContentSignals(robots);
}
