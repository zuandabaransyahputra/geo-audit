Traffic from AI assistants is real but awkward to measure: some of it arrives with a clear referrer, some arrives with none, and some is folded into ordinary search traffic. This article shows what you can measure, how, and where the blind spots are.

## What a visit from an assistant looks like

When someone clicks a source link in an AI answer, their browser usually opens your page with a referrer from the assistant's domain. Hostnames you are likely to see include:

- `chatgpt.com` (and the older `chat.openai.com`)
- `perplexity.ai` and `www.perplexity.ai`
- `claude.ai`
- `gemini.google.com`
- `copilot.microsoft.com`

Other assistants and AI search tools have their own domains, and new ones appear regularly, so treat any list as a starting point and check your own referral reports for hostnames you don't recognise.

Some assistants also add UTM parameters to outbound links. Links from ChatGPT search, for example, often carry `utm_source=chatgpt.com`. Analytics tools then attribute the session to that source even when the referrer is missing. Don't rely on it being present for every assistant or every link.

## Why your numbers are a lower bound

Many clicks from assistants arrive with no referrer at all:

- Desktop and mobile apps often open links without passing a referrer.
- Browser privacy settings, privacy extensions and `Referrer-Policy` rules can strip or reduce it.
- People copy a URL from an answer and paste it into a new tab.

These visits show up as "direct" traffic. So whatever your reports say about AI referrals, the true figure is likely to be higher. Treat the numbers as a trend line and a minimum, not a complete count.

Google is a special case. Clicks from AI Overviews and AI Mode come from Google's own domain and are reported as ordinary Google organic traffic. In Search Console, Google has said these appear in the performance report under the "Web" search type, combined with other results rather than in a separate AI filter. You can't isolate them cleanly, so watch overall impressions and clicks for queries where AI features are likely to appear.

## A GA4 channel for AI assistants

In Google Analytics 4 you can group AI referrals into their own channel instead of leaving them scattered across "Referral":

1. Go to **Admin**, then **Data display**, then **Channel groups**, and create a new channel group (copy the default one so the other channels stay intact).
2. Add a channel called "AI assistants" with the condition **Source** matches regex:

```txt
^(.*\.)?(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$
```

3. Move the new channel **above** "Referral". Channels are evaluated in order, and the first match wins.
4. Use the new channel group in your acquisition reports, or in an exploration with "Session source" and "Landing page" as dimensions.

For a quick look without changing configuration, create a free-form exploration, add "Session source" as a dimension and apply a filter using the same regex. Landing pages in that report tell you which content assistants actually link to.

The same idea works in other analytics tools: filter or segment by referrer hostname and by `utm_source`.

## Server logs: what the bots fetch

Analytics scripts only see visitors who run JavaScript. Crawlers and assistant fetchers usually don't, so server or CDN logs are where you see them. Each vendor documents what its agents do:

- **OpenAI** ([docs](https://developers.openai.com/api/docs/bots)): `OAI-SearchBot` for ChatGPT search, `GPTBot` for training, `ChatGPT-User` for actions users trigger, where OpenAI notes that robots.txt rules may not apply.
- **Anthropic** ([docs](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)): `ClaudeBot` for training, `Claude-User` for fetches when users ask, `Claude-SearchBot` for search quality.
- **Perplexity** ([docs](https://docs.perplexity.ai/guides/bots)): `PerplexityBot` for search results (not training), `Perplexity-User` for user actions, which generally ignores robots.txt.
- **Search engines:** `Googlebot`, `Bingbot` and `Applebot` (Siri, Spotlight and Safari features, per [Apple](https://support.apple.com/en-us/119829)).

Count requests per agent in a combined-format access log:

```sh
grep -oE 'GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Googlebot|bingbot|Applebot' access.log \
  | sort | uniq -c | sort -rn
```

Use `grep -i` if your logs vary in case (Bing's agent is written `bingbot`). To see which pages one agent requests and what status it got:

```sh
grep 'OAI-SearchBot' access.log | awk '{print $9, $7}' | sort | uniq -c | sort -rn | head -20
```

The field numbers assume the common Nginx and Apache combined format; adjust them for yours. A pattern of 403 or 429 responses for a search agent usually points at a firewall or rate limit, which is covered in [Why classic SEO basics still matter for AI search](/insights/seo-basics-for-ai-search).

User-initiated agents such as `ChatGPT-User`, `Claude-User` and `Perplexity-User` are a useful signal of their own: each request generally means someone asked an assistant about a page on your site.

## Verify bots before trusting the numbers

User agent strings are trivial to fake, and scrapers often pretend to be well-known crawlers. Before acting on log data, or before allowing an agent through a firewall, verify it:

- **Reverse DNS, then forward DNS.** Look up the hostname for the IP, check it belongs to the vendor's domain, then resolve that hostname back and confirm it returns the same IP. Google documents this for `googlebot.com` and `google.com`, Microsoft for `search.msn.com`, and Apple for `applebot.apple.com`.

```sh
host 66.249.66.1
host crawl-66-249-66-1.googlebot.com
```

- **Published IP ranges.** Several vendors, including Google, Microsoft, OpenAI and Perplexity, publish lists of the IP addresses their crawlers use. Check each vendor's bot documentation for the current lists and compare the request IP against them.

Requests that claim to be a crawler but fail verification should be excluded from your counts.

## Putting it together

A practical setup has three parts: an "AI assistants" channel in analytics for human visits, a regular log summary for crawler and assistant fetches, and Search Console for Google, read with the caveats above. None of these is complete on its own, and none needs invented benchmarks to be useful: compare your own numbers month to month. For the other items worth checking before you start measuring, see [The GEO checklist: get found and cited by AI assistants](/insights/geo-checklist).
