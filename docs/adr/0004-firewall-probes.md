# 0004. Firewall probe targets and verdicts

Status: accepted (2026-11-23)

## Decision

- Probe list, in order: OAI-SearchBot, Claude-SearchBot, PerplexityBot, GPTBot; at most four. A crawler is only probed
  when it has a vendor-documented user agent (Claude-SearchBot has none, so it is skipped), robots.txt allows it, and,
  for GPTBot, there is no training opt-out (including one from Content-Signal).
- No probes when the normal request is not 2xx (nothing to compare with) or robots.txt is unreachable or 5xx (every
  crawler is treated as blocked already).
- Verdict order: `error` (no response), `challenge`, `blocked` (401, 403, 429, 5xx), `different` (any other non-2xx, or a
  2xx with under 30% of the normal page's words when the normal page has at least 50), `ok`. Other non-2xx statuses
  such as 404 or 406 are `different` because the brief lists the blocking statuses explicitly.
- Challenge detection: the documented `cf-mitigated: challenge` header, plus a few body markers known from challenge
  pages (Cloudflare challenge-platform path and "Just a moment..." title, Vercel Security Checkpoint, DataDome, HUMAN).
  The markers are heuristics, not vendor claims, and only count when the normal response lacks them.
- `different` is reported in the check but does not change visibility; only `blocked` and `challenge` make a product
  `partly`.
- With no probes, firewall-probe is `info` (vacuous) and keeps its full weight, so a site is not penalised for having
  nothing to probe.
- The probe marker uses the major.minor version: `GEO-Audit-probe/0.2`.
