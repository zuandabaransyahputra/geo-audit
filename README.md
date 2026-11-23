# GEO Audit

**Can ChatGPT, Claude, Perplexity and Google AI Overviews find, read and cite your site?** Enter a URL, get a 0–100 score
and copy-paste fixes. Free, open source, no sign-up.

[![CI](https://github.com/zuandabaransyahputra/geo-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/zuandabaransyahputra/geo-audit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ai-geo-audit.svg)](https://www.npmjs.com/package/ai-geo-audit)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**Web:** https://geoaudit-tool.vercel.app · **CLI:** `npx ai-geo-audit example.com`

![GEO Audit report for zuanda.web.id: score 96, grade A, with category scores and top fixes](docs/screenshot.png)

## Why

More people ask an assistant than click ten blue links. Assistants answer from pages their crawlers are allowed to fetch,
can read without running JavaScript, and can attribute to someone. GEO (generative engine optimisation) is mostly about
getting those basics right, and most sites get at least one of them wrong: a robots.txt rule that blocks `OAI-SearchBot`,
a React shell with no text in the HTML, no JSON-LD saying who is behind the site.

GEO Audit checks all of it in a few seconds and tells you exactly what to change, with snippets filled in with your
own domain, title and description.

## What it checks

27 checks in four categories. Each check has a weight inside its category; the last column is its share of the
overall score.

| Category | Check | ID | Weight | Of total |
| --- | --- | --- | ---: | ---: |
| AI access | AI search and assistant crawlers can reach the page | `ai-search-bots` | 5 | 10.7% |
| AI access | Page may be indexed and quoted (meta robots, `X-Robots-Tag`: noindex, nosnippet, noai) | `indexing-directives` | 4 | 8.6% |
| AI access | llms.txt is present and well formed | `llms-txt` | 2 | 4.3% |
| AI access | llms-full.txt is available | `llms-full-txt` | 1 | 2.1% |
| AI access | robots.txt is present and valid | `robots-txt` | 1 | 2.1% |
| AI access | AI training crawlers (blocking is allowed, it only costs a little) | `ai-training-bots` | 1 | 2.1% |
| AI-readable content | Content is readable without JavaScript (no empty SPA shell) | `server-rendered-text` | 4 | 9.1% |
| AI-readable content | One clear H1 | `single-h1` | 2 | 4.5% |
| AI-readable content | Headings form an outline | `heading-order` | 1 | 2.3% |
| AI-readable content | Images have alt text | `img-alt` | 1 | 2.3% |
| AI-readable content | Language is declared | `lang` | 1 | 2.3% |
| AI-readable content | Freshness signals (`dateModified`, `<time>`, article meta) | `freshness` | 1 | 2.3% |
| AI-readable content | Author or publisher is identified | `authorship` | 1 | 2.3% |
| Structured data | JSON-LD present and parses | `jsonld-present` | 3 | 8.6% |
| Structured data | Useful schema.org types (Organization, Person, WebSite, Article, Product, FAQPage ...) | `jsonld-types` | 2 | 5.7% |
| Structured data | Key fields per type (Google's required properties, simplified) | `jsonld-fields` | 2 | 5.7% |
| Structured data | Microdata and RDFa (noted, not scored) | `microdata-rdfa` | 0 | info |
| SEO basics | Page returns 200 | `http-status` | 3 | 5.0% |
| SEO basics | Served over HTTPS | `https` | 2 | 3.3% |
| SEO basics | Title tag length | `title` | 2 | 3.3% |
| SEO basics | Meta description length | `meta-description` | 2 | 3.3% |
| SEO basics | XML sitemap found and referenced in robots.txt | `sitemap` | 2 | 3.3% |
| SEO basics | Canonical URL | `canonical` | 1 | 1.7% |
| SEO basics | Open Graph tags | `open-graph` | 1 | 1.7% |
| SEO basics | Few redirects | `redirects` | 1 | 1.7% |
| SEO basics | Twitter / X card | `twitter-card` | 0.5 | 0.8% |
| SEO basics | Mobile viewport | `viewport` | 0.5 | 0.8% |

**Crawlers checked against robots.txt:** search and assistant agents `Googlebot` (also AI Overviews), `Bingbot` (also
Copilot), `Applebot` (Siri, Spotlight), `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`,
`Perplexity-User`; training agents `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider`,
`meta-externalagent`.

The robots.txt parser follows [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309): user-agent groups (merged when repeated),
the bot's own group over `*`, longest match wins with `Allow` winning ties, `*` wildcards, a trailing `$` anchor,
percent-encoding normalisation, and `/robots.txt` always allowed. A 5xx robots.txt counts as "keep out", a 4xx as
"allow everything", as crawlers treat them.

## Report insights

Every report (web, Markdown export and CLI) adds rule-based insights on top of the checks. There is no AI model
involved: each sentence comes from a template fed by the same results the checks produce, so the insights cannot
contradict them. The code is in [`packages/core/src/insights.ts`](packages/core/src/insights.ts).

- **Summary:** two to four sentences on what the score means. It covers which assistants can or cannot reach the page,
  the single biggest gap, and the projected score after the quick wins.
- **Who can see you:** a status per AI product (see the mapping below).
- **Action plan:** failing and warning checks, ordered by points gained per unit of effort. They are grouped into
  *Quick wins* (minutes), *This week* (hours) and *Bigger projects* (days), with the projected score after the quick
  wins and after the full plan. Effort labels are static, conservative estimates per check (`EFFORT` in
  `insights.ts`). The projection assumes each fix is complete, so treat it as an upper bound.
- **Strengths:** what the site already does well.
- **Learn more:** each check links to the [insights article](#insights-articles) that explains it.

### Who can see you: crawler to product mapping

A product is **blocked** when robots.txt blocks its primary crawler. It is **partly** visible when only a secondary
crawler is blocked, or when one of these applies:

- the page is marked `noindex` (blocked for Google and Bing, which document it; partly for the others);
- `nosnippet` / `max-snippet:0` is set (partly for Google and Apple, whose answers honour it);
- the content only appears after JavaScript runs (partly for everyone except Google, whose crawler renders JS);
- the page returns an error status.

A 404/410 page, or a robots.txt that answers 5xx, counts as blocked everywhere.

| Product | Primary crawler (blocked = Blocked) | Secondary crawlers (blocked = Partly) | Source |
| --- | --- | --- | --- |
| ChatGPT search | `OAI-SearchBot` | `ChatGPT-User` (user-initiated fetches; OpenAI notes robots.txt may not apply) | [OpenAI crawlers](https://developers.openai.com/api/docs/bots) |
| ChatGPT training | `GPTBot` | none | [OpenAI crawlers](https://developers.openai.com/api/docs/bots) |
| Claude | `Claude-SearchBot` | `Claude-User`, `ClaudeBot` (training) | [Anthropic crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| Perplexity | `PerplexityBot` | `Perplexity-User` (Perplexity says it generally ignores robots.txt) | [Perplexity crawlers](https://docs.perplexity.ai/guides/bots) |
| Google AI Overviews & Gemini | `Googlebot` (AI Overviews need indexed, snippet-eligible pages) | `Google-Extended` (Gemini training and grounding; does not affect Search) | [AI features](https://developers.google.com/search/docs/appearance/ai-features), [Google crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) |
| Microsoft Copilot & Bing | `Bingbot` | none | [Bing crawlers](https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0) |
| Apple Intelligence & Siri | `Applebot` (Siri, Spotlight, Safari) | `Applebot-Extended` (model training only; pages stay in search) | [About Applebot](https://support.apple.com/en-us/119829) |
| Common Crawl & other model builders | none | `CCBot`, `Bytespider`, `meta-externalagent` (all blocked = Blocked) | [CCBot](https://commoncrawl.org/ccbot) |

Robots rules are what vendors document. Whether a given product actually fetched or cited a page is something only
your server logs and analytics can tell (see
[How to measure traffic from AI assistants](https://geoaudit-tool.vercel.app/insights/measuring-ai-traffic)).

## Insights articles

The site also hosts short, practical guides at [`/insights`](https://geoaudit-tool.vercel.app/insights). They are
Markdown files in [`apps/web/content/insights`](apps/web/content/insights), with metadata in
[`apps/web/lib/insights.ts`](apps/web/lib/insights.ts). The articles are listed in the sitemap and in the site's own
`/llms.txt`, and `/llms-full.txt` contains their full text.

## How scoring works

- Every check earns 0–100% of its weight: pass = 100%, fail = 0%, warnings in between (often proportional, e.g. the
  share of crawlers allowed or images with alt text).
- **Category score** = earned weight ÷ total weight × 100.
- **Overall score** = weighted average of the categories:

  | Category | Weight |
  | --- | ---: |
  | AI access | 30% |
  | AI-readable content | 25% |
  | Structured data | 20% |
  | SEO basics | 25% |

- **Grade:** A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 55, F below.
- **Points per fix** = how many overall points the check would add if it passed. The action plan orders fixes by
  points per unit of effort.

The weights are a judgement call: being reachable and quotable matters most, and the classic SEO basics still count
because AI search is built on top of search indexes. They live in
[`packages/core/src/score.ts`](packages/core/src/score.ts) and [`packages/core/src/checks.ts`](packages/core/src/checks.ts).
PRs with evidence are welcome.

## Use it

### Web

Open https://geoaudit-tool.vercel.app, enter a URL, share the report link (`/report?url=example.com`). Each report has a
"Copy as Markdown" button for issues and PRs, and its own share image showing the domain and score.

JSON: `GET /api/audit?url=example.com`.

### CLI

```sh
npx ai-geo-audit example.com
npx ai-geo-audit https://example.com/blog/post --markdown > geo-report.md
npx ai-geo-audit example.com --json | jq .score
npx ai-geo-audit example.com --min-score 80   # exit 1 below 80: use it as a CI gate after deploys
```

Options: `--json`, `--markdown`/`--md`, `--all` (details for passing checks too), `--min-score <n>`, `--no-color`.

## Self-host

Requirements: Node 22+, pnpm 10.

```sh
git clone https://github.com/zuandabaransyahputra/geo-audit
cd geo-audit
pnpm install
pnpm dev          # web app on http://localhost:3000
pnpm test         # core tests (Vitest)
pnpm build        # builds the CLI and the web app
node packages/cli/dist/index.js example.com
```

**Vercel:** import the repo and set the project's Root Directory to `apps/web` (framework: Next.js, Node runtime). One
optional environment variable: `OG_SECRET` (any long random string) signs the scores in share-image URLs, so
link previews on Slack, WhatsApp or LinkedIn show the score card instantly without re-running the audit; without it
they show a generic card. If you deploy under a different domain, change `SITE_URL` in
[`packages/core/src/constants.ts`](packages/core/src/constants.ts); it is used for metadata, share links and the
crawler's User-Agent.

### Layout

```
packages/core   checks, robots.txt parser, llms.txt validator, JSON-LD extraction, scoring, safe fetching (pure TS, tested)
packages/cli    the `ai-geo-audit` command (bundles core)
apps/web        Next.js App Router site: home, /report, /insights, /api/audit, /api/og
```

## Safety

The server fetches URLs that users type in, so it is careful about where it goes:

- Only `http`/`https`, only ports 80 and 443, no credentials in URLs, no `localhost`/`.local`/`.internal` names.
- DNS answers are checked at connect time: private, loopback, link-local, CGNAT, multicast, reserved, cloud metadata
  (`169.254.169.254`, `fd00:ec2::254`), IPv6 ULA and IPv4-embedding IPv6 ranges are refused. Node connects to the exact
  address that was checked, so DNS rebinding does not help. Every redirect (max 5) is re-checked.
- 8 s timeout and 2 MB limit per request (counted after decompression), content-type allow-lists, no cookies.
- Pages are parsed with a light HTML parser; fetched JavaScript is never executed.
- Per-IP rate limit (in memory, best effort) and a 10-minute result cache.
- Requests identify honestly as `GEO-Audit/0.1 (+https://geoaudit-tool.vercel.app)`.

## Privacy

The hosted version fetches only the page you enter plus `/robots.txt`, `/llms.txt`, `/llms-full.txt` and the sitemap
of that origin. Results are kept in server memory for 10 minutes so shared links load instantly, then dropped. URLs
are not stored in a database, there are no accounts and no analytics. Report pages are `noindex`.

## Related

- [astro-geo](https://github.com/zuandabaransyahputra/astro-geo): an Astro integration that generates `llms.txt`,
  `llms-full.txt` and typed, injection-safe JSON-LD. If your Astro site misses those checks, it fixes them at build time.
- [llmstxt.org](https://llmstxt.org), [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309),
  [schema.org](https://schema.org), [Google's structured data docs](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).

## Credits

Built by [Zuanda Baransyah Putra](https://zuanda.web.id), freelance web developer (Next.js, Astro, React). Need help
fixing what the report found? [Hire me](https://zuanda.web.id/contact).

MIT licensed. See [LICENSE](./LICENSE).
