# ai-geo-audit

How well can ChatGPT, Claude, Perplexity and Google AI Overviews find, read and cite your site? One command, a 0–100 score and concrete fixes.

```sh
npx ai-geo-audit example.com
```

Checks robots.txt rules for 23 AI and search crawlers (scored per AI product), firewall blocks with up to 4 probe requests,
noindex/nosnippet, JSON-LD, server-rendered content, headings, alt text, dates, authorship and SEO basics. The score is capped
when major AI products are blocked. Agent readiness (llms.txt, control names, WebMCP) is reported but not scored.

| Option | Description |
| --- | --- |
| `--json` | Full report as JSON |
| `--markdown`, `--md` | Report as Markdown (paste into an issue) |
| `--all` | Show details for passing checks too |
| `--min-score <n>` | Exit 1 when the score (after any cap) is below `n` (CI gate) |
| `--training-optout` | You block AI training crawlers on purpose; do not count it against the score |
| `--no-color` | No ANSI colours (`NO_COLOR` is respected) |

Both `ai-geo-audit` and `geo-audit` are installed as commands. Requires Node 20+.

Web version, scoring details and source: https://github.com/zuandabaransyahputra/geo-audit

Built by [Zuanda Baransyah Putra](https://zuanda.web.id). Need help fixing your report? [Hire me](https://zuanda.web.id/contact).
