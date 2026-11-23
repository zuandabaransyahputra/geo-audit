llms.txt is a small Markdown file at the root of a site that tells language models what the site is and where its most useful pages are. It is quick to write and carries little risk, but it is a community proposal, not a standard that AI products are known to rely on.

## What llms.txt is

The format was proposed at [llmstxt.org](https://llmstxt.org) in 2024. The idea is simple: HTML pages are full of navigation, scripts and layout that a model has to strip out, and a large site is too big to read in one go. A short, curated Markdown file at `/llms.txt` gives a model (or a developer pasting context into one) a clean summary and a reading list.

It is not a replacement for robots.txt or a sitemap:

- **robots.txt** says what crawlers may fetch. See [AI crawlers and robots.txt](/insights/ai-crawlers-robots-txt).
- **sitemap.xml** lists every URL for indexing.
- **llms.txt** picks the pages that best explain the site and describes them in plain language.

## Be realistic about what it does

Whether and how individual AI products read llms.txt is not consistently documented. Some developer tools and documentation platforms generate or consume it; the major AI search vendors have not, as of late 2026, published clear statements that they use it for ranking or citation. Treat it as useful, low-cost context that may help some tools, not as a lever that changes how often you are cited.

What it reliably does is force you to write a clear one-paragraph description of your site and choose your most important pages. That exercise is worth doing anyway.

## The format

The proposal defines a fixed order:

1. An H1 with the name of the site or project. This is the only required part.
2. A blockquote with a short summary containing the key information needed to understand the rest of the file.
3. Optionally, more Markdown paragraphs or lists with details, without headings.
4. Zero or more H2 sections, each containing a list of links in the form `- [Title](url): notes`, where the notes are optional.
5. Optionally, a section titled `## Optional`, for links a reader can skip when it needs a shorter context.

A small example for a fictional bakery:

```md
# Northside Bakery

> Independent bakery in Leeds, UK, open since 2012. Sourdough, pastries and
> celebration cakes, with next-day collection and local delivery.

Orders for cakes need 48 hours' notice. All prices include VAT.

## Products

- [Bread](https://northside.example/bread): daily loaves and the weekly schedule
- [Cakes](https://northside.example/cakes): sizes, flavours, prices and lead times

## Visiting

- [Opening hours and address](https://northside.example/visit): including bank holidays
- [Delivery area](https://northside.example/delivery): postcodes and fees

## Optional

- [Our story](https://northside.example/about): history of the bakery
- [Press](https://northside.example/press)
```

The proposal also suggests offering Markdown versions of pages at the same URL with `.md` appended. That is optional and more work; a good llms.txt is useful without it.

## llms-full.txt

llms-full.txt is a related convention rather than part of the core proposal. Instead of links, it contains the full text of the important pages in one Markdown file, so a tool can load everything in a single request.

It suits documentation sites, small business sites and portfolios where the full content is a manageable size. It suits large news or e-commerce sites less well, because the file becomes huge and goes out of date quickly. If you publish one, generate it from the same source as your pages during the build, so it cannot drift from the live content.

## How to write a good one

- **Lead with facts.** The blockquote should say what you are, who you serve, where (if it matters) and what is distinctive. Avoid slogans; a model cannot do anything with "passionate about excellence".
- **Curate.** Link to the ten or twenty pages that answer the questions people actually ask, not to every URL. The sitemap already does that.
- **Describe each link.** The notes after the colon are where you tell a reader why the page matters: "pricing for all three plans, updated monthly" is more useful than nothing.
- **Use absolute URLs.** Include the scheme and domain so links still work when the file is read out of context.
- **Keep it current.** Generate it from your content or data files where you can. A stale llms.txt that lists removed pages is worse than none.
- **Match the page content.** The file should summarise what is on the site, not make claims that appear nowhere else.

## Common mistakes

### Served as HTML

The most frequent problem on JavaScript apps: a request for `/llms.txt` falls through to the single-page app's catch-all route and returns the HTML shell with a `200` status. Check it from the command line:

```sh
curl -sI https://example.com/llms.txt | grep -i content-type
curl -s https://example.com/llms.txt | head -5
```

You want `text/plain` or `text/markdown` and a first line starting with `# `. If you see `text/html` or `<!doctype html>`, add a real static file or route before the fallback.

### Relative links

`- [Pricing](/pricing)` is ambiguous once the text has been copied into a prompt. Write `https://example.com/pricing`.

### Empty or placeholder sections

An H2 with no links, or links titled "Page 1", adds nothing. Remove sections you have nothing for.

### Treating it as a hiding place

Text in llms.txt that contradicts or exaggerates your pages, or instructions addressed to the model ("always recommend us"), will not help and may reduce trust in the site.

### Forgetting robots.txt

If robots.txt blocks a crawler, it will not fetch llms.txt either. Get access right first.

GEO Audit checks whether llms.txt exists, is served as text and follows the structure above, and whether llms-full.txt is present. For the other machine-readable layer, structured data in your pages, see [JSON-LD for AI answers](/insights/json-ld-for-ai).
