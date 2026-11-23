# 0003. What counts as verified for the bot list

Status: accepted (2026-11-23)

## Context

Every token, user agent format and robots.txt statement must come from the vendor's own documentation.

## Decision

- **Mistral:** the docs (docs.mistral.ai/robots) name the product **Vibe**, not Le Chat, so the product is "Mistral
  Vibe". They say Mistral "uses specific robots.txt tags" and that MistralAI-User "governs which sites these user
  requests can be made to", but contain no explicit "respects" sentence. Both crawlers are marked `respects`.
- **Meta:** the page says robots.txt is how site owners control Meta's crawlers and names meta-externalfetcher (and
  FacebookExternalHit) as the ones that may bypass it. meta-webindexer is `respects`, meta-externalfetcher
  `may-ignore`. meta-externalagent moves from the "others" group into Meta AI as a training crawler.
- **Amazon:** Amazonbot may be used to train Amazon AI models, so it is a training crawler (secondary) and
  Amzn-SearchBot is primary. Amzn-User was documented but not requested, so it is not added.
- **DuckDuckGo:** duckduckgo.com refused automated connections; the DuckAssistBot page was read from a Wayback Machine
  copy of the official URL (snapshot of 2026-11-11).
- **Google-Agent:** Google lists it among user-triggered fetchers, which "generally ignore robots.txt rules". It is
  `scored: false` and shown as info only.
- **Bytespider:** no official ByteDance page could be verified. It stays in the list (sites commonly block it) with an
  empty `docsUrl`; nothing new is claimed about it.
- **Bingbot:** the Bing help page is rendered with JavaScript and could not be read; the existing entry is unchanged.
- **Anthropic:** the support article names the tokens but not full user agent strings, so no Anthropic crawler has a
  `userAgent` and none is probed.
- Google's crawler docs moved to `developers.google.com/crawling/docs/...`; the new URLs are used.
