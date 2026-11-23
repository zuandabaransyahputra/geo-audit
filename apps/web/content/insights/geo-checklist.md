A practical checklist for making a site easy for AI search and assistants to find, read and cite. Each item links to the article that explains it; start with access, because nothing else matters if crawlers can't reach your pages.

[GEO Audit](/) checks most of these items automatically for any URL. To keep deploys passing, run `npx ai-geo-audit example.com --min-score 80` in CI: it exits with an error when the score drops below the threshold.

New to the topic? Read [What is GEO, and how is it different from SEO?](/insights/what-is-geo) first.

## Crawler access

- [ ] robots.txt exists at `/robots.txt`, returns 200 and parses without errors. ([AI crawlers](/insights/ai-crawlers-robots-txt))
- [ ] Search and assistant crawlers you want are allowed: `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Googlebot`, `Bingbot`, `Applebot`, and if you care about them `DuckAssistBot`, `Amzn-SearchBot`, `MistralAI-Index` and `meta-webindexer`. ([AI crawlers](/insights/ai-crawlers-robots-txt))
- [ ] You have made a deliberate choice about training crawlers (`GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`); blocking them does not remove you from search. ([AI crawlers](/insights/ai-crawlers-robots-txt))
- [ ] You understand that user-initiated agents (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) act for a person, and some may not follow robots.txt. ([AI crawlers](/insights/ai-crawlers-robots-txt))
- [ ] Your CDN, firewall or bot protection does not block or challenge the crawlers you allow in robots.txt. GEO Audit's probe requests give a first hint; your CDN logs confirm it. ([AI crawlers](/insights/ai-crawlers-robots-txt))
- [ ] Rate limits don't return 429 to legitimate crawlers during normal crawling. ([SEO basics](/insights/seo-basics-for-ai-search))

## Indexing directives

- [ ] Pages you want cited have no `noindex` in a meta robots tag or `X-Robots-Tag` header. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] No unintended `nosnippet` or very low `max-snippet`; Google uses these to limit what AI features can show. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] Staging-only directives (a site-wide `noindex`, `Disallow: /`) were removed at launch. ([AI crawlers](/insights/ai-crawlers-robots-txt))
- [ ] Pages you want kept out of results use `noindex` and stay crawlable; a robots.txt `Disallow` stops crawling, not necessarily indexing, and hides the `noindex` from crawlers. ([AI crawlers](/insights/ai-crawlers-robots-txt))

## Content readable without JavaScript

- [ ] The main text of each page is in the initial HTML response, not only after scripts run. ([JavaScript guide](/insights/javascript-and-ai-crawlers))
- [ ] `curl` or "view source" on a page shows the headings and paragraphs you expect. ([JavaScript guide](/insights/javascript-and-ai-crawlers))
- [ ] Single-page apps use server-side rendering or prerendering for content pages. ([JavaScript guide](/insights/javascript-and-ai-crawlers))
- [ ] Important content is not fetched later by tabs or "load more" buttons. ([JavaScript guide](/insights/javascript-and-ai-crawlers))
- [ ] Links are real `<a href>` elements, so crawlers can follow them. ([JavaScript guide](/insights/javascript-and-ai-crawlers))

## Content structure and attribution

- [ ] Each page has exactly one clear, descriptive `<h1>`. ([writing guide](/insights/writing-quotable-content))
- [ ] Headings form an outline (`h2`, then `h3`) and read like topics or questions. ([writing guide](/insights/writing-quotable-content))
- [ ] Each section opens with a direct answer, followed by detail. ([writing guide](/insights/writing-quotable-content))
- [ ] Claims are concrete: numbers you can back up, names, prices, places and dates. ([writing guide](/insights/writing-quotable-content))
- [ ] Key terms are defined once in a plain sentence. ([writing guide](/insights/writing-quotable-content))
- [ ] Comparisons and steps use real HTML tables and lists. ([writing guide](/insights/writing-quotable-content))
- [ ] Published and updated dates are visible and use `<time datetime>`. ([writing guide](/insights/writing-quotable-content))
- [ ] Articles name an author with a short bio and profile links. ([writing guide](/insights/writing-quotable-content))
- [ ] Informative images have alt text; decorative ones have `alt=""`. ([writing guide](/insights/writing-quotable-content))
- [ ] `<html lang>` is set to the page's language. ([writing guide](/insights/writing-quotable-content))
- [ ] Company, product and people names are spelled the same everywhere. ([writing guide](/insights/writing-quotable-content))

## Structured data

- [ ] Each page has JSON-LD that parses as valid JSON. ([JSON-LD guide](/insights/json-ld-for-ai))
- [ ] The site describes who is behind it with an `Organization` or `Person` node, plus `WebSite`. ([JSON-LD guide](/insights/json-ld-for-ai))
- [ ] Content pages use a fitting type (`Article`, `BlogPosting`, `Product`, `FAQPage` ...) with its key fields. ([JSON-LD guide](/insights/json-ld-for-ai))
- [ ] Nodes are linked with consistent `@id`s instead of being repeated. ([JSON-LD guide](/insights/json-ld-for-ai))
- [ ] `datePublished` and `dateModified` match the dates shown on the page. ([writing guide](/insights/writing-quotable-content))
- [ ] `sameAs` links point to your real profiles. ([JSON-LD guide](/insights/json-ld-for-ai))
- [ ] Only content visible on the page is marked up, and no self-serving reviews. ([JSON-LD guide](/insights/json-ld-for-ai))
- [ ] JSON-LD output escapes `<` so page text can't break the script tag. ([Astro guide](/insights/astro-llms-txt-json-ld))

## SEO basics

- [ ] Pages return HTTP 200. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] Everything is served over HTTPS, with HTTP redirected. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] Redirects go straight to the final URL, without chains. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] Each page has a unique, specific `<title>` and meta description. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] Each page has an absolute, self-referencing canonical URL. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] An XML sitemap exists and is referenced from robots.txt with a `Sitemap:` line. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] Open Graph and X card tags give shared links a title, description and image. ([SEO basics](/insights/seo-basics-for-ai-search))
- [ ] A mobile viewport meta tag is present. ([SEO basics](/insights/seo-basics-for-ai-search))

## Optional: agent readiness

These help AI agents and developer tools that act on pages. They do not affect search: Google says Search ignores llms.txt. GEO Audit reports them without scoring them.

- [ ] If you publish `/llms.txt`, it is served as plain text, has a `# Site name` H1, at least one Markdown link and more than a line of content (the rules Lighthouse checks). ([llms.txt guide](/insights/llms-txt))
- [ ] Its links are absolute, return 200 and point to the pages that best explain the site. ([llms.txt guide](/insights/llms-txt))
- [ ] Optionally, `/llms-full.txt` has the readable text of your key pages, generated at build time so it never goes stale. ([Astro guide](/insights/astro-llms-txt-json-ld))
- [ ] Every button, link and form field has an accessible name: visible text, a `<label>`, or `aria-label` for icon-only controls. Agents and screen readers find controls by that name.
- [ ] Forms an agent could usefully fill in are named as tools with Chrome's experimental declarative WebMCP attributes, `toolname` and `tooldescription` on the `<form>`. ([Chrome docs](https://developer.chrome.com/docs/ai/webmcp/declarative-api))

## Measurement

- [ ] Analytics groups AI assistant referrers (such as `chatgpt.com`, `perplexity.ai`, `claude.ai`) into their own channel. ([measuring guide](/insights/measuring-ai-traffic))
- [ ] You read those numbers as a lower bound, since many app clicks arrive without a referrer. ([measuring guide](/insights/measuring-ai-traffic))
- [ ] Search Console is set up, knowing that AI Overviews and AI Mode clicks are counted with ordinary web results. ([measuring guide](/insights/measuring-ai-traffic))
- [ ] Server or CDN logs are summarised by crawler user agent, including status codes. ([measuring guide](/insights/measuring-ai-traffic))
- [ ] Bot traffic is verified by reverse DNS or published IP ranges before you trust it. ([measuring guide](/insights/measuring-ai-traffic))
- [ ] An audit runs after each deploy (the CI command above), so a regression in robots.txt or rendering is caught early. ([SEO basics](/insights/seo-basics-for-ai-search))
