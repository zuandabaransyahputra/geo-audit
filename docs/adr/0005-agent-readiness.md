# 0005. Agent readiness counting and llms.txt statuses

Status: accepted (2026-11-23)

## Decision

- The category has weight 0. Its checks keep their own weights only for the "x of y passed" tally: llms-txt,
  llms-full-txt and interactive-names weigh 1 and are counted; webmcp-declarative weighs 0 and is never counted (it is
  always info). A check that is not `pass` (including a missing file shown as info) counts as not passed.
- llms.txt statuses, aligned with Lighthouse's audit: fetch error or 4xx other than 429 = info (missing); 5xx or 429 =
  warn; 200 with an empty body or an HTML page = warn; 200 failing Lighthouse's rules (H1 anywhere, a Markdown link,
  50+ characters) = warn; otherwise pass, with llmstxt.org style issues as notes.
- llms-full.txt: missing = info, present but not Markdown = warn.
- interactive-names uses a simplified accessible name from static HTML: aria-labelledby (resolved), aria-label, an
  associated or wrapping label for fields, text content, img alt or svg aria-label inside, title. A placeholder is not a
  name. Submit and reset inputs have a default name. Hidden means `hidden`, `aria-hidden="true"`, inline
  display:none or visibility:hidden on the element or an ancestor, or `type="hidden"`.
- webmcp-declarative offers a fix only when the page has forms but none declared; then it appears in the optional group.
- Interactive-names and webmcp-declarative link to the GEO checklist, which gained an "Optional: agent readiness" section.
