import { describe, expect, it } from 'vitest';
import { parsePage } from '../src/html';
import { extractJsonLd, missingFields, nameOf, normalizeType } from '../src/jsonld';

describe('extractJsonLd', () => {
  it('extracts @graph members and nested typed objects', () => {
    const ex = extractJsonLd([
      JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': '#site', name: 'Acme', url: 'https://acme.dev' },
          { '@type': 'Organization', '@id': '#org', name: 'Acme Ltd', url: 'https://acme.dev', address: { '@type': 'PostalAddress', addressCountry: 'PT' } },
        ],
      }),
    ]);
    expect(ex.blocks).toBe(1);
    expect(ex.invalid).toEqual([]);
    expect(ex.nodes.map((n) => n.types[0])).toEqual(['WebSite', 'Organization', 'PostalAddress']);
    expect(ex.ids.get('#org')?.name).toBe('Acme Ltd');
  });

  it('handles top-level arrays, multiple types and prefixed types', () => {
    const ex = extractJsonLd([JSON.stringify([{ '@type': ['Organization', 'schema:LocalBusiness'] }, { '@type': 'http://schema.org/Person', name: 'Z' }])]);
    expect(ex.nodes[0]!.types).toEqual(['Organization', 'LocalBusiness']);
    expect(ex.nodes[1]!.types).toEqual(['Person']);
  });

  it('reports blocks that do not parse and keeps the good ones', () => {
    const ex = extractJsonLd(['{"@type": "Person", "name": "A",}', '{"@type":"WebSite","name":"x","url":"y"}', '   ']);
    expect(ex.blocks).toBe(3);
    expect(ex.invalid.map((i) => i.index)).toEqual([0, 2]);
    expect(ex.nodes).toHaveLength(1);
  });

  it('strips HTML comment and CDATA wrappers', () => {
    const ex = extractJsonLd(['<!-- {"@type":"Person","name":"A"} -->', '//<![CDATA[\n{"@type":"Person","name":"B"}\n//]]>']);
    expect(ex.invalid).toEqual([]);
    expect(ex.nodes).toHaveLength(2);
  });

  it('does not loop forever on deep input', () => {
    let deep: Record<string, unknown> = { '@type': 'Thing' };
    for (let i = 0; i < 100; i++) deep = { child: deep };
    expect(() => extractJsonLd([JSON.stringify(deep)])).not.toThrow();
  });
});

describe('normalizeType', () => {
  it('strips vocab prefixes', () => {
    expect(normalizeType('https://schema.org/Article')).toBe('Article');
    expect(normalizeType('schema:FAQPage')).toBe('FAQPage');
    expect(normalizeType('Product')).toBe('Product');
  });
});

describe('missingFields', () => {
  const node = (types: string[], data: Record<string, unknown>) => ({ types, data: { '@type': types, ...data } });

  it('checks articles', () => {
    expect(missingFields(node(['BlogPosting'], { headline: 'h', author: { name: 'a' }, datePublished: '2026-01-01', image: 'x' }))).toEqual([]);
    expect(missingFields(node(['Article'], { headline: 'h' }))).toEqual(['author', 'datePublished', 'image']);
  });

  it('checks products need offers, review or rating', () => {
    expect(missingFields(node(['Product'], { name: 'p' }))).toEqual(['offers | review | aggregateRating']);
    expect(missingFields(node(['Product'], { name: 'p', offers: { price: 1 } }))).toEqual([]);
  });

  it('checks FAQ questions and breadcrumbs', () => {
    expect(missingFields(node(['FAQPage'], { mainEntity: [{ '@type': 'Question', name: 'q', acceptedAnswer: { text: 'a' } }] }))).toEqual([]);
    expect(missingFields(node(['FAQPage'], { mainEntity: [{ '@type': 'Question', name: 'q' }] }))).toEqual(['mainEntity[].name/acceptedAnswer']);
    expect(missingFields(node(['BreadcrumbList'], { itemListElement: [{ position: 1, name: 'Home' }] }))).toEqual([]);
    expect(missingFields(node(['BreadcrumbList'], { itemListElement: [] }))).toEqual(['itemListElement']);
  });

  it('checks organisations, people and websites', () => {
    expect(missingFields(node(['Organization'], { name: 'o' }))).toEqual(['url']);
    expect(missingFields(node(['Person'], { name: 'p' }))).toEqual([]);
    expect(missingFields(node(['WebSite'], { url: 'u' }))).toEqual(['name']);
    expect(missingFields(node(['LocalBusiness'], { name: 'b' }))).toEqual(['address']);
  });

  it('skips pure references', () => {
    expect(missingFields({ types: ['Person'], data: { '@type': 'Person', '@id': '#me' } })).toEqual([]);
  });
});

describe('nameOf', () => {
  it('resolves @id references', () => {
    const ex = extractJsonLd([JSON.stringify({ '@graph': [{ '@type': 'Person', '@id': '#me', name: 'Zed' }, { '@type': 'Article', author: { '@id': '#me' } }] })]);
    expect(nameOf({ '@id': '#me' }, ex)).toBe('Zed');
    expect(nameOf([{ name: 'A' }], ex)).toBe('A');
    expect(nameOf('Plain', ex)).toBe('Plain');
    expect(nameOf({ '@id': '#unknown' }, ex)).toBeUndefined();
  });
});

describe('parsePage JSON-LD and microdata', () => {
  it('finds ld+json scripts regardless of attribute case and params', () => {
    const page = parsePage(`<html><head>
      <script type="application/ld+json">{"@type":"Person","name":"A"}</script>
      <script type="Application/LD+JSON; charset=utf-8">{"@type":"WebSite"}</script>
      <script>var x = "<script>";</script>
    </head><body><div itemscope itemtype="https://schema.org/Product"></div><div vocab="https://schema.org/" typeof="Event"></div></body></html>`);
    expect(page.jsonLd).toHaveLength(2);
    expect(page.microdataTypes).toEqual(['https://schema.org/Product']);
    expect(page.rdfaTypes).toEqual(['Event']);
  });
});
