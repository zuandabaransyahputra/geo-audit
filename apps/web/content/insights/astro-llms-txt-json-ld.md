Astro produces static HTML by default, which already puts it ahead for AI crawlers that don't run JavaScript. This article shows how to add the remaining pieces: llms.txt, llms-full.txt, JSON-LD, a sitemap and robots.txt, either with an integration or by hand.

## What you are adding and why

- **llms.txt** is a short Markdown file at the site root that summarises the site and links its most useful pages, following the [llms.txt proposal](https://llmstxt.org). See [llms.txt and llms-full.txt: what they are and how to write them](/insights/llms-txt) for the format.
- **llms-full.txt** is the optional companion with the readable text of your pages in one file.
- **JSON-LD** describes who is behind the site and what each page is, in schema.org terms. See [The JSON-LD types that matter for AI answers](/insights/json-ld-for-ai).
- **A sitemap and robots.txt** tell crawlers which URLs exist and which they may fetch.

## The quick way: astro-geo

[astro-geo](https://github.com/zuandabaransyahputra/astro-geo) is an open-source Astro integration (Astro 5 or newer) that covers the first three. At build time it writes `llms.txt` from your config and your built pages, and optionally `llms-full.txt` with the readable text of each included page, with nav, footer, scripts and hidden elements removed. It also provides a `<JsonLd />` component that outputs one escaped `<script type="application/ld+json">` with a connected `@graph`, plus typed helpers such as `person()`, `organization()`, `blogPosting()`, `faqPage()` and `breadcrumbs()` that keep `@id`s consistent across pages. It adds no runtime JavaScript.

```sh
npx astro add astro-geo
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import geo from 'astro-geo';

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    geo({
      name: 'Acme Studio',
      description: 'Acme Studio builds fast marketing sites for small software companies.',
      llms: { pages: true, full: true },
    }),
  ],
});
```

`pages: true` lists every built page under a "Pages" section, using each page's title and meta description. If a `public/llms.txt` or your own endpoint already exists, the integration leaves it alone and logs a warning, so you can switch between approaches safely.

If you prefer no dependency, the rest of this article shows the manual version.

## llms.txt as an Astro endpoint

A file in `src/pages` that exports a `GET` function becomes an endpoint. With static output, Astro calls it at build time and writes the result to `dist/llms.txt`.

```ts
// src/pages/llms.txt.ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('blog');
  const url = (path: string) => new URL(path, site).href;

  const body = [
    '# Acme Studio',
    '',
    '> Acme Studio builds fast marketing sites for small software companies.',
    '',
    '## Pages',
    '',
    `- [Services](${url('/services')}): What we build and what it costs`,
    `- [Contact](${url('/contact')}): Start a project`,
    '',
    '## Blog',
    '',
    ...posts.map((post) => `- [${post.data.title}](${url(`/blog/${post.id}`)}): ${post.data.description}`),
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

This assumes a `blog` content collection with `title` and `description` in its schema; drop that part if you don't have one. `site` comes from your config, so set it (see below). An `llms-full.txt.ts` endpoint works the same way: loop over your entries and output each one's title and body text.

For a small site that rarely changes, a hand-written `public/llms.txt` is a perfectly good alternative.

## JSON-LD in a layout

Put the site-wide nodes in your base layout and let pages pass their own:

```astro
---
// src/layouts/Base.astro
interface Props {
  title: string;
  schema?: Record<string, unknown>[];
}
const { title, schema = [] } = Astro.props;
const site = Astro.site!.href;

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${site}#website`, url: site, name: 'Acme Studio' },
    { '@type': 'Organization', '@id': `${site}#organization`, name: 'Acme Studio', url: site },
    ...schema,
  ],
};
const json = JSON.stringify(graph).replace(/</g, '\\u003c');
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{title}</title>
    <script type="application/ld+json" set:html={json} />
  </head>
  <body>
    <slot />
  </body>
</html>
```

Two details matter here:

- **Escape `<`.** `set:html` inserts the string without escaping, and `JSON.stringify` does not escape `<`. A title containing `</script>` would end the tag early and could inject markup. Replacing `<` with `\u003c` keeps the JSON valid and parses to the same value.
- **Astro leaves the script alone.** A `<script>` with a `type` attribute is not bundled or processed, so the JSON appears in the HTML exactly as written.

A blog post page can then pass a `BlogPosting` node with `headline`, `datePublished` and `author: { '@id': '...#organization' }` through the `schema` prop.

## Sitemap and robots.txt

Install the official sitemap integration and set `site`, which it needs to build absolute URLs:

```sh
npx astro add sitemap
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://example.com',
  integrations: [sitemap()],
});
```

It writes `sitemap-index.xml` (plus numbered sitemap files) to the build output. Reference the index in a static robots.txt in `public/`, which Astro copies to the site root unchanged:

```txt
# public/robots.txt
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap-index.xml
```

Which AI crawlers to allow or block is a separate decision, covered in [AI crawlers in robots.txt: search bots vs training bots](/insights/ai-crawlers-robots-txt).

## Checking the result

Run `npm run build` and open `dist/llms.txt`, `dist/robots.txt` and the HTML of a few pages. Paste a page's JSON-LD into the [Schema Markup Validator](https://validator.schema.org) to catch mistakes, then go through [The GEO checklist: get found and cited by AI assistants](/insights/geo-checklist) for everything else worth verifying after deploy.
