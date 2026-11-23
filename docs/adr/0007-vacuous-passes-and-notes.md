# 0007. Vacuous passes, notes and strengths

Status: accepted (2026-11-23)

## Decision

- Vacuous passes: img-alt with no images, heading-order with fewer than three headings, interactive-names with no
  controls, firewall-probe with no probes. They keep their score but are never strengths.
- When server-rendered-text fails, single-h1, heading-order and img-alt are not strengths either.
- Notes are added where a pass has a real caveat: llms.txt style issues, `Content-Signal: search=no` or `ai-input=no`
  for all crawlers (on ai-search-bots), and `max-snippet:N` with N above 0 (on indexing-directives). Strengths skip
  any check with notes.
- The firewall-probe pass carries no note; the "indicative" wording is in the warning summary, where it matters.
- The llms-txt strength now reads "llms.txt gives agents and tools a map of the site", without "well-formed".
