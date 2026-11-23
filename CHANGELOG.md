# Changelog

## 0.2.0 (2026-11-23)

The score now answers the question in the title: can AI assistants find, read and cite the site?

### Scoring

- **Per-product crawler score.** `ai-search-bots` is scored per AI product (major products 1, others 0.5) instead of per
  crawler, so small crawlers no longer dilute a blocked major one. A blocked primary crawler costs the whole product; a
  blocked secondary or may-ignore crawler costs half. A blocked Googlebot or Bingbot still fails.
- **Score cap.** Blocked major products cap the overall score: one at 89, two at 79, three or four at 69, five or six at
  54. An app shell (no text without JavaScript) caps it at 69. Reports gain `rawScore` and `cap`; the grade and
  `--min-score` use the capped score.
- **One source of truth.** The crawler score, the "Who can see you" panel and the cap all come from one product status
  function.
- **Firewall and CDN probes.** New `firewall-probe` check (AI access, weight 3). The page is fetched again as up to four
  AI crawlers that robots.txt allows, with the vendor's user agent plus a `GEO-Audit-probe` marker, to spot 403s,
  challenges and stripped pages. Results are indicative.
- AI access weights are now: ai-search-bots 5, indexing-directives 4, firewall-probe 3, robots-txt 1, ai-training-bots 1.

### Agent readiness (not scored)

- New category shown as "x of y passed". llms.txt and llms-full.txt move here: a missing file is information, and a file
  that is present is checked against Lighthouse's llms.txt rules.
- New checks: `interactive-names` (buttons, links and fields with an accessible name) and `webmcp-declarative` (forms
  declared as WebMCP tools).
- A separate "Optional: agent readiness" group in the action plan, outside quick wins and projections.

### Crawlers and robots.txt

- Bot list is now data with owner, purpose, product, documentation URL, robots.txt behaviour and verification date.
- New crawlers: DuckAssistBot, Amzn-SearchBot, Amazonbot, MistralAI-Index, MistralAI-User, meta-webindexer,
  meta-externalfetcher, and Google-Agent (shown, not scored).
- New products: DuckDuckGo AI-assisted answers, Amazon Alexa & search, Mistral Vibe, Meta AI. Products are grouped into
  major and other.
- `Content-Signal` lines are parsed and reported (`contentSignals`), not scored.

### Training opt-out

- `?training=optout`, `--training-optout`, or `Content-Signal: ai-train=no` for all crawlers mark blocked training
  crawlers as deliberate: they stop counting and show as "Opted out". Without it, they are never a quick win.

### Fixes

- Strengths skip passes with nothing to check and passes with notes; content strengths are dropped for app shells.
- Passing checks can carry notes, shown as "Pass · notes".
- The hire CTA matches the report's main problem.
- Fix snippets use real data: the llms.txt template is built from nav links and the sitemap, and the JSON-LD template
  takes `sameAs` and `logo` from the page (or leaves them out).
- The share card keeps to the four scored categories and carries the training opt-out.

### Other

- `checks.ts` is split into one module per category.
- Requests identify as `GEO-Audit/0.2.0`.
- Articles updated: llms.txt (Google's and Lighthouse's position), AI crawlers (new bots, content signals, probes),
  the GEO checklist and What is GEO (llms.txt is optional).
- Decisions are recorded in `docs/adr`.

## 0.1.0 (2026-11-23)

Initial release.
