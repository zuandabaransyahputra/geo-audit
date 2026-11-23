AI search did not replace search engines; most of it is built on top of them. If a page has basic technical SEO problems, those problems usually carry straight through to AI answers.

## AI search sits on top of search indexes

Google's documentation on [AI features in Search](https://developers.google.com/search/docs/appearance/ai-features) is explicit: to appear as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet. Google also says there are no additional technical requirements beyond that. In other words, the entry ticket is ordinary SEO. The same page notes that the usual controls apply: `noindex` keeps a page out, and `nosnippet`, `data-nosnippet` and `max-snippet` limit what can be shown from it, so check that none of them is set by accident.

Other assistants work in a similar way. ChatGPT search uses OpenAI's `OAI-SearchBot` crawler, Perplexity uses `PerplexityBot`, and Microsoft Copilot draws on Bing. Each of them needs to fetch your page, get a normal response and understand what it is about. The rest of this article covers the basics that make that possible. Crawler access rules in robots.txt have their own article: [AI crawlers in robots.txt: search bots vs training bots](/insights/ai-crawlers-robots-txt).

## The page must return HTTP 200

A crawler that receives a 403, 429 or 503 does not see your content, however good it is. Check that the pages you care about return `200 OK`:

```sh
curl -sI https://example.com/pricing | head -n 1
```

The most common hidden cause is bot protection. Web application firewalls, CDN bot settings and "under attack" modes can challenge or block crawlers while browsers work fine. Some CDN and hosting providers offer a switch to block AI crawlers, and on some services it may be enabled by default. If you want AI search visibility:

- review your CDN or firewall dashboard for AI bot or "verified bot" settings;
- allow the search and assistant crawlers you want, ideally by the vendor's verified identity rather than by user agent string alone;
- look in your server or CDN logs for those user agents receiving 403 or challenge responses.

A quick user agent test only tells you part of the story, because many firewalls also check IP addresses:

```sh
curl -sI -A "OAI-SearchBot" https://example.com/ | head -n 1
```

## HTTPS and short redirect chains

Serve every page over HTTPS, with HTTP requests redirected to it. Browsers warn about plain HTTP, and search engines prefer secure URLs when choosing which version to index.

Keep redirects short. Each hop costs time and gives a crawler another chance to give up. A chain such as `http://example.com` to `https://example.com` to `https://www.example.com` to `https://www.example.com/en/` should be collapsed into a single redirect to the final URL. To see how many hops a URL takes:

```sh
curl -sIL -o /dev/null -w '%{num_redirects} redirects, ends at %{url_effective}\n' http://example.com
```

Also update internal links to point at final URLs, so crawlers don't hit redirects at all.

## Title and meta description

The `<title>` is still one of the strongest signals of what a page is about, and it is often what an assistant shows when it lists a source. The meta description is frequently used as the summary.

```html
<title>Delivery times and costs | Acme Shop</title>
<meta name="description" content="UK orders arrive in 2 to 3 working days; international orders in 5 to 10. See costs by country and how tracking works.">
```

As rough guidance, titles of around 50 to 60 characters and descriptions of around 120 to 160 characters tend to display without being cut off. These are not rules: Google truncates by pixel width and may rewrite both. What matters more is that each page has its own specific title and description that match the content.

## Canonical URLs and an XML sitemap

A canonical link tells search engines which URL is the main version of a page when the same content is reachable at several addresses (with tracking parameters, with and without a trailing slash, and so on):

```html
<link rel="canonical" href="https://example.com/delivery">
```

Use absolute URLs, point each page at itself unless it really is a duplicate, and keep the canonical consistent with your internal links and sitemap.

An XML sitemap lists the URLs you want crawled. Reference it from robots.txt with an absolute URL so every crawler can find it:

```txt
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

Keep `<lastmod>` accurate (the date the content last changed, not the build date). Google has said it ignores `<priority>` and `<changefreq>`, so there is no need to tune them.

## Link previews: Open Graph and X cards

When someone pastes your link into a chat app, a messenger or a social network, the preview comes from Open Graph tags, with X (Twitter) card tags as an addition. They do not affect rankings, but a page shared with no title or image looks broken and gets fewer clicks.

```html
<meta property="og:type" content="article">
<meta property="og:title" content="Delivery times and costs">
<meta property="og:description" content="UK orders arrive in 2 to 3 working days.">
<meta property="og:url" content="https://example.com/delivery">
<meta property="og:image" content="https://example.com/og/delivery.png">
<meta name="twitter:card" content="summary_large_image">
```

An image of 1200 by 630 pixels is a widely used size. Use absolute URLs for `og:image` and `og:url`.

## Mobile viewport

Google indexes the mobile version of pages. A page without a viewport meta tag renders as a zoomed-out desktop layout on phones, which hurts usability and can affect how the page is evaluated:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

## Checking it all

None of this is new, which is the point: GEO builds on a working SEO foundation rather than replacing it. GEO Audit checks the status code, HTTPS, redirects, title, description, canonical, sitemap, Open Graph, X card and viewport alongside the AI-specific checks. The full list is in [The GEO checklist: get found and cited by AI assistants](/insights/geo-checklist), and the question of how much traffic these pages then receive from assistants is covered in [How to measure traffic from AI assistants](/insights/measuring-ai-traffic).
