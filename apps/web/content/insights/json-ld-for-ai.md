JSON-LD is a block of schema.org data in your page that states facts in a form machines do not have to guess at: who publishes the site, what the page is, when it was written, what a product costs. This guide covers the types worth adding, how to connect them, and how to avoid the common errors.

## What structured data does, and what it does not

Search engines use schema.org markup to understand pages and to power features such as rich results, knowledge panels and product listings. Google documents its supported types in [Search Central](https://developers.google.com/search/docs/appearance/structured-data/search-gallery).

For AI answers, be careful with expectations. No major vendor has confirmed structured data as a ranking or citation factor for its AI features, and Google says AI Overviews have "no additional technical requirements" beyond normal indexing. What JSON-LD does reliably is remove ambiguity: it states that "Sam Patel" is the author, that 2026-03-14 is the publication date and that £24.00 is the price, without relying on a parser to infer those from layout. When systems do read it, it gives them clean facts. When they do not, it still feeds the search features many AI products build on.

One rule matters more than any type choice: the data must match what is visible on the page. Markup that describes content users cannot see breaks Google's guidelines and helps nobody.

## The types that matter

### Organization or Person

This is the "who is behind it" node, and the most useful one for most sites. Use `Organization` (or a subtype such as `LocalBusiness`) for a company, `Person` for an individual. Include `name`, `url`, `logo` or `image`, and `sameAs`: a list of profile URLs (LinkedIn, GitHub, Wikipedia, Companies House, a social account) that confirm the same entity elsewhere.

### WebSite

Describes the site as a whole: `name`, `url`, and a `publisher` pointing at the Organization or Person. It is a good anchor for the other nodes.

### WebPage

Describes the current page: `name`, `url`, `isPartOf` the WebSite, and optionally `dateModified` and `breadcrumb`.

### Article and BlogPosting

For editorial content. The key fields are `headline`, `author` (a Person or Organization, ideally with a `url`), `datePublished`, `dateModified` and `image`. Dates in ISO 8601 format give a clear freshness signal; update `dateModified` only when the content genuinely changes.

### Product and Offer

For things you sell. `Product` carries `name`, `image`, `description`, `sku` or `gtin`, and `brand`; a nested `Offer` carries `price`, `priceCurrency`, `availability` and `url`. Keep prices in sync with the page, ideally from the same data source.

### FAQPage

Marks up question and answer pairs that are visible on the page. Google limited FAQ rich results to a small set of authoritative sites in 2023, so do not expect the expanded listing. The markup is still a clean statement of question and answer, and it should reflect a real FAQ, not keywords dressed up as questions.

### BreadcrumbList

Shows where the page sits in the site's hierarchy. Each `ListItem` has a `position`, `name` and `item` (URL).

### LocalBusiness

A subtype of Organization for anywhere with a physical location or service area. Add `address`, `telephone`, `openingHoursSpecification`, `geo` and `priceRange` where they apply. Use the most specific subtype that fits, such as `Bakery` or `Dentist`.

## Connecting nodes with @graph and @id

Rather than several separate scripts, put all nodes in one `@graph` and give each a stable `@id`, usually the page or site URL plus a fragment. Nodes then refer to each other by `@id` instead of repeating data.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#org",
      "name": "Example Studio",
      "url": "https://example.com",
      "logo": "https://example.com/logo.png",
      "sameAs": ["https://www.linkedin.com/company/example-studio"]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com",
      "name": "Example Studio",
      "publisher": { "@id": "https://example.com/#org" }
    },
    {
      "@type": "BlogPosting",
      "@id": "https://example.com/blog/pricing-guide#article",
      "headline": "How we price small website projects",
      "datePublished": "2026-03-14",
      "dateModified": "2026-09-02",
      "author": { "@type": "Person", "name": "Sam Patel", "url": "https://example.com/about" },
      "publisher": { "@id": "https://example.com/#org" },
      "isPartOf": { "@id": "https://example.com/#website" },
      "mainEntityOfPage": "https://example.com/blog/pricing-guide"
    }
  ]
}
</script>
```

The same `@id` values should be used on every page, so the Organization on your home page and the publisher on an article are recognisably the same thing.

## Escaping script content

JSON-LD sits inside a `<script>` element, and the HTML parser ends that element at the first `</script>` it finds, even inside a JSON string. If any value comes from user input or a CMS, a string such as `</script><script>alert(1)</script>` can break out and inject markup.

`JSON.stringify` does not protect against this. Escape `<` as its Unicode form, which is still valid JSON and parses back to the same value:

```js
const json = JSON.stringify(data).replace(/</g, '\\u003c');
// then output: <script type="application/ld+json">${json}</script>
```

Many frameworks offer a helper that does this for you; check that yours does before passing raw strings into a script tag.

## Validating

Use two tools, because they check different things:

- [Rich Results Test](https://search.google.com/test/rich-results): shows which Google features your markup is eligible for and flags missing required properties.
- [Schema Markup Validator](https://validator.schema.org): checks the markup against the full schema.org vocabulary, including types Google does not use.

Also check the rendered HTML, not just your template. If JSON-LD is injected by client-side JavaScript, crawlers that do not run scripts will not see it. See [JavaScript and AI crawlers](/insights/javascript-and-ai-crawlers).

## A sensible starting set

For most sites, in order:

1. Organization or Person, with `sameAs`, on every page.
2. WebSite, linked to it.
3. Article or BlogPosting on editorial pages, with real dates and a named author.
4. Product and Offer, or LocalBusiness, if they describe what you do.
5. BreadcrumbList on deeper pages.

GEO Audit checks that JSON-LD is present, parses, uses useful types and has their key fields. For the editorial side of being cited, see [writing quotable content](/insights/writing-quotable-content).
