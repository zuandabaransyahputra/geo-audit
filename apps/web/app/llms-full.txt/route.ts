import { allArticles } from '@/lib/insights';
import { AUTHOR_NAME, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export function GET() {
  const parts = [
    '# GEO Audit Insights',
    '',
    `> Practical guides to getting a website found, read and cited by AI search and assistants. Written by ${AUTHOR_NAME}. Source: ${SITE_URL}/insights`,
    '',
  ];
  for (const a of allArticles()) {
    parts.push(`## ${a.title}`, '', `URL: ${SITE_URL}/insights/${a.slug}`, `Published: ${a.published}`, '', a.description, '');
    // Shift article headings down one level so each article stays under its own H2.
    parts.push(a.markdown.replace(/^(#{2,5}) /gm, '#$1 ').trim(), '');
  }
  return new Response(parts.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
