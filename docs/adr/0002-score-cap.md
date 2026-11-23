# 0002. How the score cap is reported and simulated

Status: accepted (2026-11-23)

## Decision

- `Report.cap` is set only when the cap actually lowers the score (`limit < rawScore`). Otherwise it is `null`, and
  "Without the cap: N" is never shown with N below the limit.
- A major product counts as blocked for the cap whatever the cause: robots.txt, `noindex` (Google, Bing), a 404/410
  page, or an unreachable robots.txt. Probes never block, so they never cap.
- Every blocked product records the checks that block it (`blockedBy`: ai-search-bots, indexing-directives,
  http-status). The action plan simulates fixes with that list: a product stays blocked while any of its checks is
  unfixed. The app-shell cap is lifted by fixing server-rendered-text.
- An action item's points are the larger of its raw impact and the capped score gain when it alone is fixed, so the fix
  that lifts the cap ranks first.
- The summary's first sentence uses the raw score when a cap applies and the raw score is 70 or more ("the page itself
  is in decent shape, but several AI assistants are kept out"), so a well-built but blocked page is not described as
  poorly built.

- Amended after review: only a real app shell (a mount point with no text, or a noscript "enable JavaScript" page)
  caps at 69. A short page whose text is all in the HTML fails server-rendered-text as thin, but is not capped and is
  not described as hidden behind JavaScript, in the cap, the summary or the visibility panel.
- Amended after review: robots directives aimed at one crawler (`<meta name="bingbot">`, `X-Robots-Tag: googlebot: ...`)
  only affect the product of that crawler. Generic ones (`<meta name="robots">`, plain `X-Robots-Tag`) affect all.
- Amended after review: while the score is capped, a fix that cannot lift the cap on its own keeps its raw points but
  is flagged `afterCap` ("+2 pts after the cap") and ranks by a current gain of 0.

## Consequences

Projections can jump by more than one check's weight when a cap lifts; that is intended.
