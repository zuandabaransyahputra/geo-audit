import { ASTRO_GEO_URL } from '../constants';
import { ENTITY_TYPES, missingFields, textValue, USEFUL_TYPES } from '../jsonld';
import type { CheckResult } from '../types';
import { plural, result, truncate, type CheckContext, type Spec } from './shared';

function jsonLdSnippet(ctx: CheckContext): string {
  const origin = ctx.url.origin;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: ctx.siteName,
        url: `${origin}/`,
        logo: `${origin}/logo.png`,
        sameAs: ['https://www.linkedin.com/company/your-company', 'https://github.com/your-company'],
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: ctx.siteName,
        url: `${origin}/`,
        ...(ctx.description ? { description: ctx.description } : {}),
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>`;
}

function astroHint(ctx: CheckContext): string {
  return ctx.page.isAstro ? ` On Astro, [astro-geo](${ASTRO_GEO_URL}) gives you typed, injection-safe helpers for this graph.` : '';
}

export function checkJsonLdPresent(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'jsonld-present',
    category: 'structured-data',
    title: 'JSON-LD structured data',
    weight: 3,
    why: 'JSON-LD states facts (who you are, what the page is) in a form search engines and assistants read without guessing.',
  };
  const { blocks, invalid, nodes } = ctx.jsonld;
  const fix = { text: `Add a JSON-LD graph to the \`<head>\` describing the site and who runs it (use Person instead of Organization for a personal site).${astroHint(ctx)}`, snippet: jsonLdSnippet(ctx), lang: 'html' };
  if (!blocks) return result(spec, 'fail', 'No `<script type="application/ld+json">` blocks.', { fix });
  if (invalid.length === blocks) {
    return result(spec, 'fail', `${plural(blocks, 'JSON-LD block')} found, none parse.`, { details: invalid.map((e) => `Block ${e.index + 1}: ${e.error}`), fix });
  }
  if (invalid.length) {
    return result(spec, 'warn', `${invalid.length} of ${blocks} JSON-LD blocks do not parse.`, {
      details: invalid.map((e) => `Block ${e.index + 1}: ${e.error}`),
      fix: { text: 'Fix the JSON syntax (trailing commas, unescaped quotes) and validate with validator.schema.org.' },
    }, 0.6);
  }
  return result(spec, 'pass', `${plural(blocks, 'JSON-LD block')} with ${plural(nodes.length, 'typed node')}.`);
}

export function checkJsonLdTypes(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'jsonld-types',
    category: 'structured-data',
    title: 'Useful schema.org types',
    weight: 2,
    why: 'Types like Organization, Person, WebSite, Article, Product and FAQPage are the ones search features and assistants use.',
  };
  const types = [...new Set(ctx.jsonld.nodes.flatMap((n) => n.types))];
  const useful = types.filter((t) => USEFUL_TYPES.has(t));
  const hasEntity = types.some((t) => ENTITY_TYPES.includes(t));
  const fix = { text: `Describe who runs the site (Organization or Person) and what this page is (WebSite, WebPage, Article, Product, FAQPage, BreadcrumbList ...).${astroHint(ctx)}`, snippet: jsonLdSnippet(ctx), lang: 'html' };
  if (!types.length) {
    return result(spec, 'fail', 'No schema.org types found.', { fix: { text: 'Add the JSON-LD graph from the fix above; it covers Organization and WebSite.' } });
  }
  if (!useful.length) return result(spec, 'fail', `Only less useful types: ${types.join(', ')}.`, { fix });
  if (!hasEntity) return result(spec, 'warn', `Types: ${useful.join(', ')}. No Organization or Person says who is behind the site.`, { fix }, 0.6);
  if (useful.length < 2) return result(spec, 'warn', `Only ${useful[0]}; add what the page itself is (WebSite, WebPage, Article ...).`, { fix }, 0.7);
  return result(spec, 'pass', `Types: ${useful.join(', ')}.`);
}

export function checkJsonLdFields(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'jsonld-fields',
    category: 'structured-data',
    title: 'Structured data has the key fields',
    weight: 2,
    why: 'Nodes missing required fields (name, url, headline, author, dates ...) are ignored for rich results and give models little to work with.',
  };
  const nodes = ctx.jsonld.nodes.filter((n) => n.types.some((t) => USEFUL_TYPES.has(t)));
  if (!nodes.length) return result(spec, 'fail', 'Nothing to check: no useful JSON-LD nodes.', { fix: { text: 'Add JSON-LD first (see above).' } });
  const problems = nodes.map((n) => ({ n, missing: missingFields(n) })).filter((p) => p.missing.length);
  if (!problems.length) return result(spec, 'pass', `All ${plural(nodes.length, 'node')} have their key fields.`);
  const score = 1 - problems.length / nodes.length;
  return result(spec, score >= 0.5 ? 'warn' : 'fail', `${problems.length} of ${plural(nodes.length, 'node')} miss key fields.`, {
    details: problems.slice(0, 10).map((p) => `${p.n.types.join('/')}${textValue(p.n.data.name) ? ` "${truncate(textValue(p.n.data.name)!, 30)}"` : ''}: missing ${p.missing.join(', ')}`),
    fix: { text: 'Fill in the missing properties; check the result with Google\'s Rich Results Test or validator.schema.org.' },
  }, score);
}

export function checkOtherStructured(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'microdata-rdfa',
    category: 'structured-data',
    title: 'Microdata and RDFa',
    weight: 0,
    why: 'Microdata and RDFa still work, but JSON-LD is easier to maintain and is what Google recommends.',
  };
  const md = [...new Set(ctx.page.microdataTypes.map((t) => t.split(/\s+/).map((x) => x.replace(/^https?:\/\/schema\.org\//, '')).join(' ')))];
  const rdfa = [...new Set(ctx.page.rdfaTypes)];
  if (!md.length && !rdfa.length) return result(spec, 'info', 'No microdata or RDFa (fine; JSON-LD is preferred).');
  const parts = [md.length ? `microdata: ${md.slice(0, 6).join(', ')}` : '', rdfa.length ? `RDFa: ${rdfa.slice(0, 6).join(', ')}` : ''].filter(Boolean);
  return result(spec, 'info', `Also found ${parts.join('; ')}.`);
}
