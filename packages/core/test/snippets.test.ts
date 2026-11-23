import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audit';
import { parsePage } from '../src/html';
import type { Report } from '../src/types';
import { fetched, GOOD_HTML, inputs } from './fixtures';

const check = (r: Report, id: string) => r.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
const noJsonLd = GOOD_HTML.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
const graphOf = (r: Report) => JSON.parse(/<script[^>]*>\n([\s\S]*)\n<\/script>/.exec(check(r, 'jsonld-present').fix!.snippet!)![1]!)['@graph'][0];

describe('anchors', () => {
  it('collects href, text and whether the link is in nav or header', () => {
    const p = parsePage('<body><header><a href="/a">A</a></header><nav><a href="/b" aria-label="Bee"><svg></svg></a></nav><main><a href="/c">C</a><a href="#x">skip</a><a href="mailto:x@y.z">mail</a></main></body>');
    expect(p.anchors).toEqual([
      { href: '/a', text: 'A', inNav: true },
      { href: '/b', text: 'Bee', inNav: true },
      { href: '/c', text: 'C', inNav: false },
    ]);
  });
});

describe('JSON-LD fix uses the page', () => {
  it('fills sameAs from social profile links and logo from the touch icon', () => {
    const html = noJsonLd
      .replace('<head>', '<head><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="icon" href="/favicon.svg">')
      .replace(
        '<body>',
        '<body><footer><a href="https://www.linkedin.com/company/acme/">LinkedIn</a><a href="https://github.com/acme">GitHub</a><a href="https://twitter.com/intent/tweet?text=hi">Share</a><a href="https://github.com/acme#readme">dup</a></footer>',
      );
    const org = graphOf(analyze(inputs({ page: fetched('https://acme.dev/', html) })));
    expect(org.sameAs).toEqual(['https://www.linkedin.com/company/acme', 'https://github.com/acme']);
    expect(org.logo).toBe('https://acme.dev/apple-touch-icon.png');
  });

  it('falls back to og:image for the logo, and drops sameAs and logo when nothing is found', () => {
    const withOg = graphOf(analyze(inputs({ page: fetched('https://acme.dev/', noJsonLd) })));
    expect(withOg.logo).toBe('https://acme.dev/og.jpg');
    expect(withOg).not.toHaveProperty('sameAs');
    const bare = graphOf(analyze(inputs({ page: fetched('https://acme.dev/', noJsonLd.replace(/<meta property="og:image"[^>]*>/, '')) })));
    expect(bare).not.toHaveProperty('logo');
    expect(bare).not.toHaveProperty('sameAs');
  });
});
