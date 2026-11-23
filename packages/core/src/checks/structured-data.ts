import { ASTRO_GEO_URL } from '../constants';
import { firstMeta } from '../html';
import { ENTITY_TYPES, missingFields, textValue, USEFUL_TYPES } from '../jsonld';
import type { CheckResult } from '../types';
import { plural, result, truncate, type CheckContext, type Spec } from './shared';

/** Profile-shaped paths per social host; anything else (posts, videos, repos, share links) is not a sameAs. */
const PROFILE: Record<string, RegExp> = {
  'linkedin.com': /^\/(company|in|school|showcase)\/[^/]+\/?$/i,
  'github.com': /^\/(?!(features|about|sponsors|topics|orgs|marketplace|login|settings|explore|pricing)\/?$)[A-Za-z0-9-]+\/?$/,
  'x.com': /^\/(?!(intent|share|home|search|hashtag|i)\/?$)[A-Za-z0-9_]+\/?$/,
  'twitter.com': /^\/(?!(intent|share|home|search|hashtag|i)\/?$)[A-Za-z0-9_]+\/?$/,
  'facebook.com': /^\/(?!(sharer|share|dialog|groups|events|watch|hashtag)\b)[A-Za-z0-9.-]+\/?$/,
  'instagram.com': /^\/(?!(p|reel|reels|explore|stories)\/?$)[A-Za-z0-9_.]+\/?$/,
  'youtube.com': /^\/(@[^/]+|(channel|c|user)\/[^/]+)\/?$/,
  'tiktok.com': /^\/@[^/]+\/?$/,
};

/** Profile links to the social sites above, from the page's own anchors. */
export function socialLinks(ctx: CheckContext, max = 8): string[] {
  const out: string[] = [];
  for (const a of ctx.page.anchors) {
    let u: URL;
    try {
      u = new URL(a.href, ctx.url);
    } catch {
      continue;
    }
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const shape = PROFILE[host];
    if (!shape || !shape.test(u.pathname) || u.searchParams.has('v')) continue;
    const href = `${u.origin}${u.pathname}`.replace(/\/$/, '');
    if (!out.includes(href)) out.push(href);
    if (out.length >= max) break;
  }
  return out;
}

/** A logo for Organization: apple-touch-icon, then a link icon, then og:image. Absolute, or undefined. */
export function logoUrl(ctx: CheckContext): string | undefined {
  const candidates = [...(ctx.page.links.get('apple-touch-icon') ?? []), ...(ctx.page.links.get('icon') ?? []), firstMeta(ctx.page, 'og:image')];
  for (const c of candidates) {
    if (!c || c.startsWith('data:')) continue;
    try {
      return new URL(c, ctx.url).href;
    } catch {
      continue;
    }
  }
  return undefined;
}

export function jsonLdSnippet(ctx: CheckContext): string {
  const origin = ctx.url.origin;
  const sameAs = socialLinks(ctx);
  const logo = logoUrl(ctx);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: ctx.siteName,
        url: `${origin}/`,
        ...(logo ? { logo } : {}),
        ...(sameAs.length ? { sameAs } : {}),
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
