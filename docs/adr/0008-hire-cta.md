# 0008. Picking the hire CTA

Status: accepted (2026-11-23)

## Decision

- "Main problem" is the scored action plan item with the most points (quick wins, this week and bigger projects together).
- Variants: server-rendered-text, then any structured-data check, then ai-search-bots, robots-txt or firewall-probe.
  indexing-directives and ai-training-bots fall back to the default copy.
- "Your page is in good shape" needs a score of 90 or more and no warning or failure in the scored categories. It moves
  to the bottom of the report; every other variant keeps the old position.
