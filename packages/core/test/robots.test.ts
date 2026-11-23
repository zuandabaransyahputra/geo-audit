import { describe, expect, it } from 'vitest';
import { agentToken, isAllowed, matchPattern, normalizeForMatch, parseRobots } from '../src/robots';

const allowed = (txt: string, bot: string, path: string) => isAllowed(parseRobots(txt), bot, path).allowed;

describe('parseRobots', () => {
  it('groups consecutive user-agent lines', () => {
    const r = parseRobots('User-agent: a\nUser-agent: b\nDisallow: /x\n\nUser-agent: c\nAllow: /');
    expect(r.groups).toHaveLength(2);
    expect(r.groups[0]!.agents).toEqual(['a', 'b']);
    expect(r.groups[0]!.rules).toHaveLength(1);
    expect(r.groups[1]!.agents).toEqual(['c']);
  });

  it('starts a new group when a user-agent follows rules, even without a blank line', () => {
    const r = parseRobots('User-agent: a\nDisallow: /\nUser-agent: b\nDisallow: /b');
    expect(r.groups).toHaveLength(2);
    expect(allowed('User-agent: a\nDisallow: /\nUser-agent: b\nDisallow: /b', 'b', '/a')).toBe(true);
  });

  it('keeps blank lines inside a group (RFC 9309 does not use them as separators)', () => {
    const txt = 'User-agent: gptbot\n\nDisallow: /';
    expect(allowed(txt, 'GPTBot', '/')).toBe(false);
  });

  it('ignores comments, BOM, CRLF and odd casing', () => {
    const txt = '﻿user-AGENT: GPTBot # openai\r\nDISALLOW: /private # secret\r\n';
    expect(allowed(txt, 'GPTBot', '/private/x')).toBe(false);
    expect(allowed(txt, 'GPTBot', '/public')).toBe(true);
  });

  it('collects sitemaps anywhere in the file', () => {
    const r = parseRobots('Sitemap: https://a.com/s1.xml\nUser-agent: *\nSitemap: https://a.com/s2.xml\nDisallow: /x');
    expect(r.sitemaps).toEqual(['https://a.com/s1.xml', 'https://a.com/s2.xml']);
    // Sitemap between user-agent and rules does not break the group.
    expect(r.groups).toHaveLength(1);
  });

  it('reports rules before any user-agent and lines without a colon as invalid', () => {
    const r = parseRobots('Disallow: /\nthis is junk\nUser-agent: *\nAllow: /');
    expect(r.invalidLines).toEqual([1, 2]);
    expect(allowed('Disallow: /\nUser-agent: *\nAllow: /', 'x', '/')).toBe(true);
  });

  it('accepts common typos of directives', () => {
    expect(allowed('useragent: *\ndissallow: /', 'x', '/a')).toBe(false);
  });

  it('extracts product tokens from user-agent values', () => {
    expect(agentToken('GPTBot/1.1')).toBe('gptbot');
    expect(agentToken('  Claude-SearchBot ')).toBe('claude-searchbot');
    expect(agentToken('*')).toBe('*');
    expect(allowed('User-agent: GPTBot/1.0\nDisallow: /', 'GPTBot', '/')).toBe(false);
  });
});

describe('group selection', () => {
  const txt = ['User-agent: *', 'Disallow: /', '', 'User-agent: Googlebot', 'Allow: /'].join('\n');

  it('uses the specific group over *', () => {
    expect(allowed(txt, 'Googlebot', '/page')).toBe(true);
    expect(allowed(txt, 'GPTBot', '/page')).toBe(false);
  });

  it('does not fall back to * rules when a specific group exists', () => {
    const t = 'User-agent: *\nDisallow: /private\n\nUser-agent: ClaudeBot\nDisallow: /tmp';
    expect(allowed(t, 'ClaudeBot', '/private')).toBe(true);
    expect(allowed(t, 'ClaudeBot', '/tmp/a')).toBe(false);
  });

  it('merges multiple groups for the same agent', () => {
    const t = 'User-agent: gptbot\nDisallow: /a\n\nUser-agent: other\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /b';
    expect(allowed(t, 'GPTBot', '/a')).toBe(false);
    expect(allowed(t, 'GPTBot', '/b')).toBe(false);
    expect(allowed(t, 'GPTBot', '/c')).toBe(true);
  });

  it('does not treat a prefix of a token as a match', () => {
    // "Claude" is not ClaudeBot, and "Googlebot" is not Googlebot-News.
    const t = 'User-agent: Claude\nDisallow: /\n\nUser-agent: Googlebot-News\nDisallow: /';
    expect(allowed(t, 'ClaudeBot', '/')).toBe(true);
    expect(allowed(t, 'Googlebot', '/')).toBe(true);
  });

  it('allows everything when no group applies or the file is empty', () => {
    expect(allowed('User-agent: other\nDisallow: /', 'GPTBot', '/')).toBe(true);
    expect(allowed('', 'GPTBot', '/')).toBe(true);
  });

  it('treats an empty Disallow as allow-all', () => {
    expect(allowed('User-agent: *\nDisallow:', 'x', '/anything')).toBe(true);
  });

  it('always allows /robots.txt', () => {
    expect(allowed('User-agent: *\nDisallow: /', 'x', '/robots.txt')).toBe(true);
  });
});

describe('longest match', () => {
  it('lets the longer rule win', () => {
    const t = 'User-agent: *\nDisallow: /shop\nAllow: /shop/public';
    expect(allowed(t, 'x', '/shop/cart')).toBe(false);
    expect(allowed(t, 'x', '/shop/public/item')).toBe(true);
  });

  it('lets allow win a tie', () => {
    const t = 'User-agent: *\nDisallow: /page\nAllow: /page';
    expect(allowed(t, 'x', '/page')).toBe(true);
  });

  it('order of rules does not matter', () => {
    const a = 'User-agent: *\nAllow: /a/b\nDisallow: /a';
    const b = 'User-agent: *\nDisallow: /a\nAllow: /a/b';
    expect(allowed(a, 'x', '/a/b/c')).toBe(true);
    expect(allowed(b, 'x', '/a/b/c')).toBe(true);
    expect(allowed(a, 'x', '/a/c')).toBe(false);
  });

  it('Allow: / with Disallow: / allows (tie goes to allow)', () => {
    expect(allowed('User-agent: *\nAllow: /\nDisallow: /', 'x', '/x')).toBe(true);
  });

  it('a longer wildcard pattern beats a shorter literal', () => {
    const t = 'User-agent: *\nAllow: /\nDisallow: /*.pdf$';
    expect(allowed(t, 'x', '/files/a.pdf')).toBe(false);
    expect(allowed(t, 'x', '/files/a.pdf?x=1')).toBe(true);
  });

  it('matches query strings as part of the path', () => {
    const t = 'User-agent: *\nDisallow: /*?sort=';
    expect(allowed(t, 'x', '/list?sort=asc')).toBe(false);
    expect(allowed(t, 'x', '/list')).toBe(true);
  });
});

describe('matchPattern', () => {
  it('is a prefix match by default', () => {
    expect(matchPattern('/fish', '/fish')).toBe(true);
    expect(matchPattern('/fish', '/fish.html')).toBe(true);
    expect(matchPattern('/fish', '/fishheads/yummy.html')).toBe(true);
    expect(matchPattern('/fish', '/Fish.asp')).toBe(false);
    expect(matchPattern('/fish', '/catfish')).toBe(false);
  });

  it('treats a trailing slash literally', () => {
    expect(matchPattern('/fish/', '/fish/salmon.htm')).toBe(true);
    expect(matchPattern('/fish/', '/fish')).toBe(false);
  });

  it('supports * wildcards', () => {
    expect(matchPattern('/fish*', '/fish.html')).toBe(true);
    expect(matchPattern('/*.php', '/index.php')).toBe(true);
    expect(matchPattern('/*.php', '/folder/filename.php?parameters')).toBe(true);
    expect(matchPattern('/*.php', '/windows.PHP')).toBe(false);
    expect(matchPattern('/a*b*c', '/axxbyyc')).toBe(true);
    expect(matchPattern('/a*b*c', '/axxcyyb')).toBe(false);
    expect(matchPattern('*', '/anything')).toBe(true);
    expect(matchPattern('/**/x', '/a/b/x')).toBe(true);
  });

  it('supports the $ end anchor', () => {
    expect(matchPattern('/*.php$', '/filename.php')).toBe(true);
    expect(matchPattern('/*.php$', '/filename.php?parameters')).toBe(false);
    expect(matchPattern('/*.php$', '/filename.php5')).toBe(false);
    expect(matchPattern('/$', '/')).toBe(true);
    expect(matchPattern('/$', '/a')).toBe(false);
    expect(matchPattern('/fish*$', '/fish/anything')).toBe(true);
  });

  it('stays fast on hostile patterns', () => {
    const pattern = `/${'*a'.repeat(50)}b`;
    const path = `/${'a'.repeat(2000)}`;
    const t0 = performance.now();
    expect(matchPattern(pattern, path)).toBe(false);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('percent-encoding', () => {
  it('normalises escapes and non-ASCII', () => {
    expect(normalizeForMatch('/caf%c3%a9')).toBe('/caf%C3%A9');
    expect(normalizeForMatch('/café')).toBe('/caf%C3%A9');
    expect(normalizeForMatch('/%7Euser')).toBe('/~user');
    expect(normalizeForMatch('/a%2Fb')).toBe('/a%2Fb');
  });

  it('matches encoded and unencoded spellings', () => {
    expect(allowed('User-agent: *\nDisallow: /café', 'x', '/caf%C3%A9/menu')).toBe(false);
    expect(allowed('User-agent: *\nDisallow: /caf%C3%A9', 'x', '/café')).toBe(false);
    expect(allowed('User-agent: *\nDisallow: /~joe', 'x', '/%7Ejoe/x')).toBe(false);
  });

  it('adds a leading slash to patterns that lack one', () => {
    expect(allowed('User-agent: *\nDisallow: private', 'x', '/private/a')).toBe(false);
  });
});
