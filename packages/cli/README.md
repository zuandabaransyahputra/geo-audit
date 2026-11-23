# ai-geo-audit

How well can ChatGPT, Claude, Perplexity and Google AI Overviews find, read and cite your site? One command, a 0–100 score and concrete fixes.

```sh
npx ai-geo-audit example.com
```

Checks robots.txt rules for 16 AI and search crawlers, noindex/nosnippet, llms.txt and llms-full.txt, JSON-LD, server-rendered
content, headings, alt text, dates, authorship and SEO basics.

| Option | Description |
| --- | --- |
| `--json` | Full report as JSON |
| `--markdown`, `--md` | Report as Markdown (paste into an issue) |
| `--all` | Show details for passing checks too |
| `--min-score <n>` | Exit 1 when the score is below `n` (CI gate) |
| `--no-color` | No ANSI colours (`NO_COLOR` is respected) |

Both `ai-geo-audit` and `geo-audit` are installed as commands. Requires Node 20+.

Web version, scoring details and source: https://github.com/zuandabaransyahputra/geo-audit

Built by [Zuanda Baransyah Putra](https://zuanda.web.id). Need help fixing your report? [Hire me](https://zuanda.web.id/contact).
