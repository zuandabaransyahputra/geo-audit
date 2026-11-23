Generative engine optimisation (GEO) is the work of making a website easy for AI search tools and assistants to find, understand and cite. It builds on SEO rather than replacing it, and most of it is the same careful technical and editorial work that good sites have always needed.

## A working definition

When someone asks ChatGPT search, Perplexity, Google's AI Overviews or a similar tool a question, the system usually retrieves a handful of web pages, reads them and writes an answer, often with links to its sources. GEO is about being one of those sources.

That breaks down into three questions about your site:

- **Can it be found?** Are the relevant crawlers allowed in, and are your pages in the indexes these tools draw on?
- **Can it be read?** Does the content arrive as plain HTML a machine can parse, with clear structure and unambiguous facts?
- **Can it be cited?** Is there a specific, self-contained passage worth quoting, and is it clear who published it and when?

None of this is a trick. There is no known switch that makes a model prefer your page. What you can control is whether you are eligible, legible and credible.

## What stays the same as SEO

A large share of GEO is ordinary SEO, done properly.

- **Crawlability.** If a crawler cannot fetch a page, nothing downstream happens. Server errors, broken redirects, blocked resources and slow responses hurt both.
- **Indexability.** Many AI answer features sit on top of a conventional search index. Google states that pages need to be indexed and eligible to be shown with a snippet to appear in AI Overviews and AI Mode, and that there are "no additional technical requirements" beyond that ([Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)). Microsoft Copilot draws on Bing's web results, so Bing indexing matters too.
- **Quality content.** Pages that answer a real question accurately, with first-hand detail, are useful to a reader and to a system assembling an answer.
- **Clean HTML and metadata.** Titles, headings, canonical URLs, sitemaps and internal links still do the job they always did.

If your SEO fundamentals are weak, fix those first. The article on [SEO basics for AI search](/insights/seo-basics-for-ai-search) covers them.

## What is different

The differences are mostly about how the output is used.

### Quoted, not just ranked

A classic results page shows ten links and lets the reader choose. An AI answer may summarise several sources into a paragraph and cite two or three. Being "position four" is less meaningful; what matters is whether a passage from your page is the clearest statement of a fact. That rewards direct answers, defined terms, specific numbers you can stand behind, and sections that make sense out of context. See [writing quotable content](/insights/writing-quotable-content).

### Machine-readable facts

Prices, opening hours, authors, publication dates and product specifications are easier to extract reliably when they are stated plainly in the HTML and, where it fits, described with schema.org structured data. Structured data is not a confirmed ranking factor for AI answers, but it removes ambiguity. The guide to [JSON-LD for AI answers](/insights/json-ld-for-ai) goes through the useful types.

### Who is behind it

Assistants and the people reading their answers both need to judge whether a source is trustworthy. Clear signals help: a named author or organisation, an about page, contact details, consistent profiles elsewhere (linked with `sameAs`), and dates that show when content was written and last reviewed.

### AI-specific crawlers

Several vendors now run separate crawlers for search, for fetching pages on a user's behalf, and for collecting training data. OpenAI, for example, documents OAI-SearchBot for search and GPTBot for training, with different consequences for blocking each ([OpenAI bots](https://developers.openai.com/api/docs/bots)). A robots.txt written years ago may block the wrong ones, or a firewall rule may block them all. The article on [AI crawlers and robots.txt](/insights/ai-crawlers-robots-txt) explains the options.

### Content that needs JavaScript

Googlebot renders JavaScript, though rendering can be delayed. Many AI crawlers fetch the HTML and do not run scripts at all. A single-page app that ships an empty shell can be invisible to them. See [JavaScript and AI crawlers](/insights/javascript-and-ai-crawlers).

## What GEO is not

It helps to be clear about the limits.

- It is not a guarantee. AI products change their retrieval and citation behaviour often, and most do not publish how they choose sources.
- It is not keyword stuffing for chatbots. Hidden text, prompt-like instructions aimed at models, or pages written only for machines are as likely to backfire as the old SEO equivalents.
- It is not a new file format that fixes everything. Proposals such as [llms.txt](/insights/llms-txt) are cheap to add and may help some tools, but they do not replace crawlable, well-structured pages.
- It is not separate from your users. Almost every change that helps an AI system read your page also helps a human skim it.

## Where to start

A practical order of work:

1. Check that search crawlers (Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, Claude-SearchBot, Applebot) can fetch your important pages, and that your robots.txt and firewall agree.
2. Confirm those pages are indexed and not marked `noindex` or `nosnippet` by accident.
3. View the raw HTML and make sure the main content is in it without JavaScript.
4. Add accurate structured data for your organisation or person, your site, and your key content types.
5. Rewrite the pages that matter most so the answer to the obvious question appears early and plainly.
6. Measure what you can. AI referral traffic is partly visible in analytics; [measuring AI traffic](/insights/measuring-ai-traffic) covers how.

GEO Audit checks most of the technical items on this list automatically, and the [GEO checklist](/insights/geo-checklist) collects the rest in one place. The editorial part, saying something useful and saying it clearly, is still up to you.
