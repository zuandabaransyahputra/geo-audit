AI companies run several crawlers, and blocking the wrong one can remove you from AI search without stopping what you meant to stop. This guide sorts the main bots by purpose and shows how to write robots.txt rules that do what you intend.

## Three kinds of AI crawler

Vendors increasingly separate their bots by job, and blocking each has different consequences.

- **Search crawlers** fetch pages so they can be shown and linked in an AI search product. Blocking them usually means you will not appear there.
- **User-triggered fetchers** load a page because a person asked an assistant to read it, follow a link or answer a question. They do not crawl automatically, and several vendors say robots.txt may not apply to them.
- **Training crawlers** collect content that may be used to train models. Blocking them is about consent for training, not about search visibility.

## The main user agents

Documented tokens as of late 2026. Vendors add and rename bots, so check the sources below.

**Search crawlers**

- `OAI-SearchBot` (OpenAI): sites that opt out "will not be shown in ChatGPT search answers".
- `Claude-SearchBot` (Anthropic): improves search result quality.
- `PerplexityBot` (Perplexity): surfaces and links sites in search; not used for training foundation models.
- `Googlebot` (Google): Google Search, including AI Overviews and AI Mode.
- `Bingbot` (Microsoft): Bing search, whose web results Microsoft Copilot also uses.
- `Applebot` (Apple): Spotlight, Siri and Safari.
- `DuckAssistBot` (DuckDuckGo): fetches pages for AI-assisted answers in DuckDuckGo Search, which cite their sources; not used to train AI models.
- `Amzn-SearchBot` (Amazon): search experiences in Amazon products such as Alexa; not used for generative AI training.
- `MistralAI-Index` (Mistral): indexes pages for Mistral search, which helps answer questions in Vibe; not used for training.
- `meta-webindexer` (Meta): improves Meta AI search results; allowing it "helps us cite and link to your content in Meta AI's responses".

**User-triggered fetchers**

- `ChatGPT-User` (OpenAI): user actions in ChatGPT and Custom GPTs; "robots.txt rules may not apply".
- `Claude-User` (Anthropic): fetches pages when users ask Claude questions.
- `Perplexity-User` (Perplexity): user actions; "generally ignores robots.txt rules".
- `MistralAI-User` (Mistral): visits a page when a Vibe user asks a question, and links the source in the answer.
- `meta-externalfetcher` (Meta): fetches links at a user's request and "may bypass robots.txt rules".
- `Google-Agent` (Google): agents on Google infrastructure acting for a user. Google says its user-triggered fetchers "generally ignore robots.txt rules", so GEO Audit lists it but never scores it.

**Training**

- `GPTBot` (OpenAI): disallowing it indicates content should not be used to train foundation models.
- `ClaudeBot` (Anthropic): collects content that could contribute to training.
- `Google-Extended` (Google): a product token, not a separate crawler, covering training future Gemini models and grounding in Gemini Apps and Vertex AI.
- `Applebot-Extended` (Apple): use of content for training Apple's foundation models.
- `CCBot` (Common Crawl): an open crawl archive, widely used for research and model training.
- `Amazonbot` (Amazon): improves Amazon products and services, which may include training Amazon AI models.
- `meta-externalagent` (Meta): use cases such as training foundation AI models or indexing content.

Sources: [OpenAI](https://developers.openai.com/api/docs/bots), [Anthropic](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Perplexity](https://docs.perplexity.ai/guides/bots), [Google crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers), [Google user-triggered fetchers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers), [Apple](https://support.apple.com/en-us/119829), [DuckDuckGo](https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot), [Amazon](https://developer.amazon.com/amazonbot), [Mistral](https://docs.mistral.ai/robots), [Meta](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/), [Common Crawl](https://commoncrawl.org/ccbot).

Bytespider (ByteDance) is also widely blocked as a training crawler, but ByteDance publishes no crawler documentation we could verify.

Note that Google-Extended "does not impact a site's inclusion in Google Search nor is it used as a ranking signal", so blocking it does not remove you from AI Overviews, which are part of Search. Likewise, pages that disallow Applebot-Extended can still appear in Apple's search results.

## How robots.txt matching works

robots.txt is standardised in [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309). A few rules from it explain most surprises.

- **Groups.** Each group starts with one or more `User-agent` lines, followed by `Allow` and `Disallow` rules.
- **One group per crawler.** A crawler obeys the group whose `User-agent` matches its product token, compared case-insensitively. If several groups name it, their rules are combined. Only if no group names it does it fall back to `User-agent: *`. A crawler with its own group ignores the `*` group entirely.
- **Longest match wins.** Within the group, the rule with the most specific (longest) matching path applies. If an `Allow` and a `Disallow` match equally, the `Allow` should win.
- **No rule means allowed.** A path that no rule matches may be crawled.

```txt
User-agent: *
Disallow: /admin/

User-agent: GPTBot
Disallow: /
```

Here GPTBot is blocked everywhere. Every other crawler, including OAI-SearchBot, is allowed except under `/admin/`. If you later add a group for `OAI-SearchBot` with its own rules, it stops reading the `*` group, so you must repeat `Disallow: /admin/` inside it.

## Example: allow AI search, block training

A common policy is to stay visible in AI search while opting out of model training.

```txt
# Search and user-triggered fetchers: allowed
User-agent: Googlebot
User-agent: Bingbot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Applebot
User-agent: DuckAssistBot
User-agent: Amzn-SearchBot
User-agent: MistralAI-Index
User-agent: MistralAI-User
User-agent: meta-webindexer
Disallow: /admin/

# Training: blocked
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
User-agent: Amazonbot
User-agent: Bytespider
User-agent: meta-externalagent
Disallow: /

# Everyone else
User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
```

robots.txt is a request, not access control. Well-behaved crawlers follow it; it does nothing against those that do not.

If you block training on purpose, GEO Audit can take that into account: open the report with `?training=optout` (or run the CLI with `--training-optout`) and the blocked training crawlers stop counting against the score.

## Content signals

Cloudflare's [managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) adds a `Content-Signal` line that says how content may be used once it is fetched, separately from whether it may be fetched:

```txt
User-Agent: *
Content-signal: search=yes, ai-train=no, use=reference
Allow: /
```

The signals are `search` (building a search index and showing results), `ai-input` (using content as input for AI answers, such as grounding) and `ai-train` (training or fine-tuning models), each `yes` or `no`. A signal that is left out neither grants nor restricts anything. Cloudflare also lists a `use` field that is still being tested.

Content signals are a statement of preference, not a crawl rule: the `Allow` and `Disallow` lines still decide what crawlers fetch. GEO Audit shows any content signals it finds on the robots.txt check without scoring them. One exception: `ai-train=no` for all crawlers is read as a deliberate training opt-out.

## noindex, nosnippet and X-Robots-Tag

robots.txt controls fetching, not indexing or how content is shown. A URL blocked in robots.txt can still be indexed from links elsewhere, and the crawler cannot see a `noindex` on a page it is not allowed to fetch.

Page-level controls do the other half:

```html
<meta name="robots" content="noindex">
<meta name="robots" content="nosnippet">
<meta name="robots" content="max-snippet:160">
<p data-nosnippet>Not to be quoted in snippets.</p>
```

The same directives can be sent as an HTTP header, which is the only option for PDFs and other non-HTML files:

```txt
X-Robots-Tag: noindex
```

Google's [AI features documentation](https://developers.google.com/search/docs/appearance/ai-features) points to these preview controls (`nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`) as the way to limit what is shown from your pages in Search, which includes AI Overviews and AI Mode. Check each vendor's documentation for whether its own products honour them.

## Failures that block crawlers silently

**A failing robots.txt.** Under RFC 9309, if robots.txt returns a server error (5xx) or cannot be reached, crawlers should assume the whole site is disallowed. A 404 is treated as "no rules". So a robots.txt route that crashes or times out can keep compliant crawlers away from every page. Make sure it returns `200` with `text/plain`.

**Bot protection and firewalls.** CDN bot-management features, WAF rules and rate limits often challenge or block unfamiliar user agents, regardless of what robots.txt says. If your logs show AI crawlers receiving `403` or challenge pages, allowlist the bots you want in your CDN settings. Several vendors publish IP ranges for verifying genuine traffic.

GEO Audit evaluates your robots.txt for each of these bots using the RFC 9309 rules above. It also sends up to four probe requests that robots.txt allows, as OAI-SearchBot, PerplexityBot and GPTBot. Each probe uses the vendor's documented user agent with `GEO-Audit-probe` added, and the tool compares the answers with a normal request. A `403`, a `429`, a `5xx`, a Cloudflare challenge (`cf-mitigated: challenge`) or a much shorter page for the crawler points at a bot rule. Treat the result as a hint: real crawlers are also verified by IP address, which a test request cannot imitate, so confirm it in your CDN logs. For the rest of the picture, see [what GEO is](/insights/what-is-geo) and the [GEO checklist](/insights/geo-checklist).
