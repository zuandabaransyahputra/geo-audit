An AI assistant can only quote what it can find, understand and attribute. This article covers the writing and markup habits that make a page easy to lift a correct answer from, without any keyword tricks.

## Start with one clear H1 and an outline of headings

A page should have one `<h1>` that says what the page is about in plain words. "Pricing for small teams" is more useful than "Welcome" or a slogan. Assistants and search engines use the H1, together with the `<title>`, to decide what question the page answers.

Under it, headings should form an outline that someone could read on its own:

- Use `<h2>` for the main sections and `<h3>` for parts inside them. Don't skip levels for styling; change the CSS instead.
- Write headings as topics or questions a reader would actually ask: "How long does delivery take?", "What the plan includes", "Cancelling your subscription".
- Avoid vague headings such as "More info" or "Our approach". Out of context, they tell a model nothing.

A good test: copy only the headings into a text file. If that list reads like a sensible table of contents, the structure is doing its job.

## Put the answer first

Assistants often pull a single paragraph, not a whole page. Make the first sentence or two under each heading the direct answer, then add the detail.

```md
## How long does delivery take?

Orders within the UK arrive in 2 to 3 working days. International orders
take 5 to 10 working days, depending on customs.

Tracking links are emailed when the parcel leaves the warehouse...
```

Compare that with a paragraph that opens with "Here at Acme, we know how important fast delivery is to you." The second version makes a model work harder and gives it nothing to quote.

Keep paragraphs short and about one thing. A paragraph that answers three questions is hard to cite for any of them.

## Use concrete, checkable facts

Specific statements are easier to quote and easier to trust than general ones:

- **Numbers you can back up:** "Plans start at €12 per month", "Founded in 2019", "Response within one working day". Only publish figures you can stand behind, and link the source if the number comes from elsewhere.
- **Names:** the product, the company, the people, the tools and standards involved.
- **Prices, places and dates:** currency included, city and country spelled out, dates in an unambiguous format.
- **Definitions:** if your page uses a term, define it once in a sentence that starts with the term: "GEO (generative engine optimisation) is...". Definition sentences are among the easiest things for an assistant to reuse.

Lists and tables help too. A comparison of plans in an HTML `<table>`, or steps in an `<ol>`, keeps facts attached to their labels when the text is extracted. Make sure they are real HTML elements, not a grid of `<div>`s styled to look like a table.

## Show dates and mirror them in JSON-LD

Freshness matters for anything that changes: prices, software versions, laws, opening hours. Show the published date, and an updated date when you make a meaningful change, on the page itself:

```html
<p>
  Published <time datetime="2026-03-04">4 March 2026</time>,
  updated <time datetime="2026-11-20">20 November 2026</time>
</p>
```

Then give the same dates in structured data, so machines don't have to guess which date on the page is the relevant one:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How long does delivery take?",
  "datePublished": "2026-03-04",
  "dateModified": "2026-11-20",
  "author": { "@type": "Person", "name": "Jane Doe", "url": "https://example.com/about/jane" }
}
```

Only change `dateModified` when the content really changes. Bumping it on every build makes the signal meaningless. See [The JSON-LD types that matter for AI answers](/insights/json-ld-for-ai) for more on structured data.

## Name the people and organisation behind the page

An assistant deciding whether to cite a page benefits from knowing who wrote it and why they would know. Give each article a named author with:

- a short bio on the page or on a linked author page, saying what they do and their relevant experience;
- links to profiles that confirm who they are (LinkedIn, GitHub, a company page);
- the same details in JSON-LD, using `author` with a `Person` node, plus `sameAs` links to those profiles.

For company pages, the publisher is the organisation: say its full name, where it is based and how to contact it.

## Keep names consistent

Use one spelling of your company, product and people everywhere: page copy, titles, JSON-LD, social profiles, directory listings. "Acme Studio", "AcmeStudio" and "Acme Studios Ltd" may look like three different things to a system trying to work out which entity a page is about. Pick a canonical form, use it consistently, and mention alternative names once if people really use them ("Acme Studio, formerly Acme Design").

## Don't forget the accessibility basics

Several accessibility habits double as machine-readability habits:

- **Alt text:** describe what an informative image shows ("Bar chart of monthly sign-ups, January to June"). Use `alt=""` for purely decorative images so they are skipped.
- **The `lang` attribute:** `<html lang="en-GB">` tells parsers which language the text is in, which helps with language detection and correct quoting.
- **Text as text:** put important information in HTML text, not inside images, canvases or content that only appears after JavaScript runs. [Making JavaScript-heavy sites readable for AI crawlers](/insights/javascript-and-ai-crawlers) explains why that last point matters.

## What not to do

Repeating a phrase, hiding text, or padding pages with question lists that nobody asks does not make content more quotable. It makes the page harder to read for people and machines alike. Write for a reader who wants a clear, specific answer, then check the structure with a tool such as GEO Audit, which flags missing H1s, broken heading order, missing alt text, dates and authorship. For the full list of related checks, see [The GEO checklist: get found and cited by AI assistants](/insights/geo-checklist).
