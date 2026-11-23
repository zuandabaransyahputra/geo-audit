If your page only shows its content after JavaScript runs, many AI crawlers will see an empty page. Here is why, how to check, and which rendering approaches fix it.

## Why JavaScript is a problem for AI crawlers

A browser downloads HTML, then runs scripts that may fetch data and build the page. Running a headless browser for every URL is slow and expensive, so many crawlers skip the second step.

- **Googlebot renders JavaScript.** Google documents a process where pages are crawled, queued for rendering in a headless Chromium, and then indexed. Rendering can happen some time after the first crawl, so content that depends on it may be indexed later.
- **Many AI crawlers do not.** Many AI search and assistant crawlers appear to fetch the raw HTML and work only with what is in it. Vendors rarely publish rendering details, and behaviour can change, so the safe assumption is that scripts will not be run.

The practical rule: if the text you want quoted is not in the HTML response, assume an AI crawler will not see it.

## How to check your site

### Fetch the raw HTML

```sh
curl -sL https://example.com/pricing | grep -i "per month"
```

Pick a sentence that appears on the rendered page. If `grep` finds nothing, the content is being added by JavaScript. To see roughly what a text-only reader gets:

```sh
curl -sL https://example.com/pricing | sed -e 's/<[^>]*>//g' | tr -s ' \n' | head -50
```

### View source, not the inspector

In a browser, use View Page Source (`view-source:` in the address bar). The element inspector shows the DOM after scripts run, which is not what a non-rendering crawler receives.

### Turn JavaScript off

Disable JavaScript in your browser's developer tools settings and reload. If the page is blank, shows a spinner, or loses its main content, so will many crawlers.

### Watch for a clean shell

A typical client-rendered app returns something like this:

```html
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index-3f9a.js"></script>
</body>
```

There is no heading, no paragraph and nothing to cite.

## Rendering approaches

The fix is to send HTML that already contains the content. There are several ways to do it.

- **Static site generation (SSG).** Pages are rendered to HTML at build time and served as files. Fast, cheap and ideal for content that changes on deploy: marketing pages, docs, blogs, portfolios.
- **Server-side rendering (SSR).** HTML is generated on the server for each request (often with caching). Suits pages with frequently changing or per-request data, such as stock levels or search results.
- **Prerendering.** A build step or service loads the client-rendered app in a headless browser and saves the resulting HTML. A useful bridge for an existing single-page app, though it adds a moving part and can serve stale content if not refreshed.
- **Hydration and islands.** The server sends complete HTML, and JavaScript then "hydrates" it to make it interactive. Island architectures hydrate only the interactive components and leave the rest as static HTML. Either way, the content is present before any script runs.

Incremental regeneration, rebuilding static pages in the background, sits between SSG and SSR.

## Frameworks at a high level

All the common meta-frameworks can produce server-rendered or static HTML. The question is usually whether a given route is configured to.

- **Next.js** (React): server components and SSR by default in the App Router, with static generation for routes that do not need request data. Content fetched in client components with `useEffect` is still client-only.
- **Nuxt** (Vue): universal rendering by default, with per-route rules for static, server or client-only rendering.
- **SvelteKit**: server-renders by default; pages can opt into prerendering, or opt out of SSR, which makes them client-only.
- **Astro**: ships static HTML by default and hydrates only the components you mark as interactive.
- **Remix** and React Router's framework mode: server-render each route, with data loaded by loaders on the server.

Plain React, Vue or Angular apps built with a client-only setup (for example a default Vite single-page app) render in the browser unless you add one of the approaches above.

## Patterns that hide content even on rendered sites

A framework that server-renders can still leave important content out of the HTML.

### App shells

Some sites server-render the header and footer but load the main body client-side. Check that the part people would quote is in the response.

### Tabs and accordions that load on click

Content in a closed tab or accordion is fine if it is in the HTML and simply hidden with CSS or the `hidden` attribute. It is a problem if the content is fetched only when someone clicks. Native `<details>` and `<summary>` elements are a simple option that keeps the text in the page.

### Infinite scroll

Items loaded as the user scrolls are usually invisible to crawlers. Provide paginated URLs with normal links (`/blog?page=2` or `/blog/page/2`) so every item is reachable from plain HTML.

### Client-fetched content

Reviews, prices, specifications and FAQs pulled from an API after load are a common gap, especially on e-commerce sites. Fetch them on the server, or render a server-side fallback.

### Structured data injected by scripts

JSON-LD added by a tag manager or client component is missing from the raw HTML. Output it server-side; see [JSON-LD for AI answers](/insights/json-ld-for-ai).

## Priorities

Start with the pages most likely to be cited: the home page, product or service pages, pricing, about, contact and your best articles. Make sure their main text, headings, dates and structured data are in the HTML response. Leave dashboards, account areas and interactive tools client-rendered if that suits them; they are rarely what an assistant should quote.

GEO Audit fetches the HTML without running JavaScript and flags pages that look like an empty shell. For crawler access rules, see [AI crawlers and robots.txt](/insights/ai-crawlers-robots-txt), and for the full list, the [GEO checklist](/insights/geo-checklist).
