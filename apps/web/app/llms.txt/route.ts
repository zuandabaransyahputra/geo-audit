import { ARTICLES } from '@/lib/insights';
import { AUTHOR_NAME, AUTHOR_URL, HIRE_URL, REPO_URL, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export function GET() {
  const body = `# GEO Audit

> Free, open-source tool that scores how well a website can be found, read and cited by AI search and assistants (ChatGPT, Claude, Perplexity, Google AI Overviews), with concrete fixes.

It checks robots.txt rules for 23 AI and search crawlers (scored per AI product, with a cap when major products are blocked), firewall blocks via probe requests, noindex/nosnippet directives, JSON-LD structured data, server-rendered content, headings, alt text, dates, authorship and SEO basics (title, description, canonical, Open Graph, sitemap, HTTPS). Agent readiness (llms.txt, control names, WebMCP) is reported but not scored. Built by ${AUTHOR_NAME}.

## Use it

- [Run an audit](${SITE_URL}/): Enter a URL, get a 0-100 score, grade and fixes
- [Report URL format](${SITE_URL}/report?url=example.com): Shareable report for any public URL
- [JSON API](${SITE_URL}/api/audit?url=example.com): The same report as JSON
- [CLI](https://www.npmjs.com/package/ai-geo-audit): \`npx ai-geo-audit example.com\`

## Insights

${ARTICLES.map((a) => `- [${a.title}](${SITE_URL}/insights/${a.slug}): ${a.description}`).join('\n')}

## Project

- [Source code](${REPO_URL}): MIT-licensed monorepo (core checks, CLI, Next.js app)
- [Author](${AUTHOR_URL}): ${AUTHOR_NAME}, freelance web developer
- [Hire the author](${HIRE_URL}): Help with GEO, SEO and fast Next.js / Astro sites

## Optional

- [Full text of all insights](${SITE_URL}/llms-full.txt): Every article as one Markdown file
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
