import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audit';
import { toMarkdown } from '../src/markdown';
import type { Report } from '../src/types';
import { fetched, GOOD_HTML, inputs, words } from './fixtures';

const check = (r: Report, id: string) => r.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
const robots = (txt: string) => ({ ok: true as const, res: fetched('https://acme.dev/robots.txt', txt, 200, { 'content-type': 'text/plain' }) });

describe('vacuous passes', () => {
  it('marks img-alt with no images and a two-heading outline as vacuous, and keeps them out of strengths', () => {
    const html = `<!doctype html><html lang="en"><head><title>Acme Studio: fast marketing sites</title></head><body><h1>Acme</h1><h2>Work</h2><p>${words(300)}</p></body></html>`;
    const r = analyze(inputs({ page: fetched('https://acme.dev/', html) }));
    expect(check(r, 'img-alt')).toMatchObject({ status: 'pass', vacuous: true });
    expect(check(r, 'heading-order')).toMatchObject({ status: 'pass', vacuous: true });
    expect(r.insights.strengths.join(' ')).not.toMatch(/alt text|clean outline/);
  });

  it('drops content strengths when the content is not in the HTML', () => {
    const shell = '<!doctype html><html lang="en"><head><title>App</title></head><body><div id="root"><h1>App</h1><h2>a</h2><h3>b</h3><img src="x" alt="x"></div><script src="/m.js"></script></body></html>';
    const r = analyze(inputs({ page: fetched('https://acme.dev/', shell) }));
    expect(check(r, 'server-rendered-text').status).toBe('fail');
    expect(r.insights.strengths.join(' ')).not.toMatch(/H1|outline|alt text/);
  });
});

describe('pass with notes', () => {
  it('adds a note for Content-Signal search=no or ai-input=no, and skips the strength', () => {
    const r = analyze(inputs({ robots: robots('User-agent: *\nContent-Signal: search=yes, ai-input=no\nAllow: /\nSitemap: https://acme.dev/sitemap.xml') }));
    const c = check(r, 'ai-search-bots');
    expect(c.status).toBe('pass');
    expect(c.notes).toEqual([expect.stringMatching(/Content-Signal: ai-input=no/)]);
    expect(r.insights.strengths.join(' ')).not.toMatch(/Every AI search and assistant crawler/);
    const md = toMarkdown(r);
    expect(md).toContain('(pass with notes)');
    expect(md).toMatch(/- Note: robots\.txt sets/);
  });

  it('adds a note for a small max-snippet', () => {
    const r = analyze(inputs({ page: fetched('https://acme.dev/', GOOD_HTML.replace('<head>', '<head><meta name="robots" content="max-snippet:50">')) }));
    const c = check(r, 'indexing-directives');
    expect(c.status).toBe('pass');
    expect(c.notes?.[0]).toMatch(/max-snippet:50/);
  });

  it('keeps notes separate from details', () => {
    const r = analyze(inputs());
    for (const c of r.categories.flatMap((x) => x.checks)) expect(c.notes ?? []).not.toEqual(c.details ?? [null]);
  });
});
