# 0001. One product status function feeds the score, the panel and the cap

Status: accepted (2026-11-23)

## Context

Until v0.1 the ai-search-bots score counted crawlers, while the "Who can see you" panel reasoned per product. The two
could disagree, and adding small crawlers diluted a blocked major one.

## Decision

- `productStatuses(ctx)` in `packages/core/src/products.ts` is the only place that maps robots.txt, indexing directives,
  rendering, page status and probes to a per-product status. It is pure and cached per check context.
- Each status carries three views: `status` (everything, including training-only crawlers), `answers` (being found and
  cited; training-only crawlers ignored) and `robots` (the robots.txt part of `answers`).
- `ai-search-bots` scores `robots` per answer product (major 1, other 0.5); the panel shows `status`; the cap counts
  major products whose `answers` is `blocked`.
- A blocked primary crawler that the vendor says may ignore robots.txt makes the product `partly`, not `blocked`, in all
  three places. No current primary crawler is may-ignore; the rule exists so the views stay consistent.
- `botVerdicts` and `directivesFor` moved to `products.ts`; `checks/ai-access.ts` re-exports them.

## Consequences

The score, panel and cap cannot contradict each other. The `serverTextFails(page)` helper mirrors the
server-rendered-text check so products can be evaluated before that check runs.
