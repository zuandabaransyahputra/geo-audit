import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audit';
import { parsePage } from '../src/html';
import { lighthouseLlmsProblems } from '../src/llms';
import type { Report } from '../src/types';
import { fetched, GOOD_HTML, inputs, SITEMAP } from './fixtures';

const check = (r: Report, id: string) => r.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
const llms = (body: string, status = 200) => ({ ok: true as const, res: fetched('https://acme.dev/llms.txt', body, status, { 'content-type': 'text/plain' }) });
const missing = { llms: llms('', 404), llmsFull: { ok: true as const, res: fetched('https://acme.dev/llms-full.txt', '', 404) } };

describe('Agent readiness category', () => {
  it('is reported as "x of y passed" and never moves the score', () => {
    const r = analyze(inputs());
    const cat = r.categories.find((c) => c.id === 'agent-readiness')!;
    expect(cat.weight).toBe(0);
    expect(cat.tally).toEqual({ passed: 3, total: 3 });
    const without = analyze(inputs(missing));
    expect(without.score).toBe(r.score);
    expect(without.categories.find((c) => c.id === 'agent-readiness')!.tally).toEqual({ passed: 1, total: 3 });
  });

  it('marks a missing llms.txt as info, still offering a fix', () => {
    const r = analyze(inputs(missing));
    expect(check(r, 'llms-txt').status).toBe('info');
    expect(check(r, 'llms-txt').fix?.snippet).toContain('# Acme Studio');
    expect(check(r, 'llms-full-txt').status).toBe('info');
  });

  it('puts agent readiness items in their own optional group, outside the projections', () => {
    const r = analyze(inputs(missing));
    const plan = r.insights.plan;
    expect(plan.optional.map((i) => i.id)).toEqual(['llms-txt', 'llms-full-txt']);
    expect([...plan.quickWins, ...plan.thisWeek, ...plan.bigger].some((i) => i.category === 'agent-readiness')).toBe(false);
    expect(plan.afterAll).toBe(plan.current);
  });

  it('validates llms.txt like Lighthouse: H1, a link, 50+ characters', () => {
    expect(lighthouseLlmsProblems('# Acme\n\n> Fast sites.\n\n- [Home](https://acme.dev/)\n')).toEqual([]);
    expect(lighthouseLlmsProblems('Acme')).toEqual(['no H1 header (`# Name`)', 'no Markdown links', 'shorter than 50 characters']);
    const bad = analyze(inputs({ llms: llms('# Acme\n\nJust a title and some words, but no links at all here.') }));
    expect(check(bad, 'llms-txt').status).toBe('warn');
    expect(check(bad, 'llms-txt').summary).toMatch(/no Markdown links/);
    const server = analyze(inputs({ llms: llms('', 503) }));
    expect(check(server, 'llms-txt').status).toBe('warn');
  });

  it('passes a Lighthouse-valid file and keeps llmstxt.org style issues as notes', () => {
    const r = analyze(inputs({ llms: llms('Intro line first\n\n# Acme Studio\n\nSee [the home page](https://acme.dev/) for more about us.\n') }));
    const c = check(r, 'llms-txt');
    expect(c.status).toBe('pass');
    expect(c.notes?.length).toBeGreaterThan(0);
  });

  it('builds the llms.txt template from nav links and the sitemap', () => {
    const html = GOOD_HTML.replace('<body>', '<body><header><nav><a href="/work">Our work</a><a href="/about">About us</a><a href="https://other.example/">Elsewhere</a><a href="#top">Top</a></nav></header>');
    const sitemap = SITEMAP.replace('</urlset>', '<url><loc>https://acme.dev/blog/a-very-long-post-title</loc></url><url><loc>https://acme.dev/pricing</loc></url><url><loc>https://acme.dev/about/</loc></url></urlset>');
    const r = analyze(inputs({ ...missing, page: fetched('https://acme.dev/', html), sitemap: { ok: true, res: fetched('https://acme.dev/sitemap.xml', sitemap, 200, { 'content-type': 'application/xml' }), source: 'robots' } }));
    const snippet = check(r, 'llms-txt').fix!.snippet!;
    expect(snippet).toContain('- [Our work](https://acme.dev/work)');
    expect(snippet).toContain('- [About us](https://acme.dev/about)');
    expect(snippet).toContain('- [Pricing](https://acme.dev/pricing)');
    expect(snippet).not.toContain('other.example');
    expect(snippet.match(/acme\.dev\/about/g)).toHaveLength(1);
    // Short paths first.
    expect(snippet.indexOf('/pricing')).toBeLessThan(snippet.indexOf('/blog/a-very-long-post-title'));
    expect(snippet).not.toMatch(/replace/);
  });

  it('falls back to placeholders marked "replace" when nothing is found', () => {
    const r = analyze(inputs({ ...missing, sitemap: { ok: true, res: fetched('https://acme.dev/sitemap.xml', '', 404), source: 'default' } }));
    expect(check(r, 'llms-txt').fix!.snippet).toMatch(/<!-- replace/);
  });
});

describe('interactive-names', () => {
  it('finds unnamed buttons, links and fields, skipping hidden ones', () => {
    const p = parsePage(`<body>
      <button>Buy</button>
      <button aria-label="Close"><svg></svg></button>
      <button class="icon menu"><svg></svg></button>
      <a href="/cart"><img src="cart.svg"></a>
      <a href="/home"><img src="h.svg" alt="Home"></a>
      <label for="q">Search</label><input id="q">
      <label>Email <input type="email"></label>
      <input name="phone">
      <input type="hidden" name="csrf">
      <input type="submit">
      <select name="size"></select>
      <div hidden><button></button></div>
      <button aria-hidden="true"></button>
      <span id="lbl">Next</span><a href="/next" aria-labelledby="lbl"></a>
      <textarea title="Message"></textarea>
    </body>`);
    expect(p.controls.total).toBe(12);
    expect(p.controls.unnamed).toEqual(['<button.icon.menu>', '<a href="/cart">', '<input name="phone">', '<select name="size">']);
  });

  it('warns with at most 8 examples and passes when everything is named', () => {
    const many = GOOD_HTML.replace('<body>', `<body>${'<button></button>'.repeat(10)}`);
    const r = analyze(inputs({ page: fetched('https://acme.dev/', many) }));
    const c = check(r, 'interactive-names');
    expect(c.status).toBe('warn');
    expect(c.details).toHaveLength(8);
    expect(check(analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML.replace('<body>', '<body><a href="/x">X</a>')) })), 'interactive-names').status).toBe('pass');
  });
});

describe('webmcp-declarative', () => {
  it('reports declared tools as info', () => {
    const html = GOOD_HTML.replace('<body>', '<body><form toolname="bookDemo" tooldescription="Books a demo call."></form><form toolname="half"></form><form></form>');
    const c = check(analyze(inputs({ page: fetched('https://acme.dev/', html) })), 'webmcp-declarative');
    expect(c.status).toBe('info');
    expect(c.weight).toBe(0);
    expect(c.summary).toBe('1 tool found: `bookDemo`.');
    expect(c.details?.[0]).toMatch(/1 form with only one/);
  });

  it('says none when there are no tools', () => {
    expect(check(analyze(inputs()), 'webmcp-declarative').summary).toMatch(/^None/);
  });
});
