import type { AuditInputs, Fetched } from '../src/types';

export const fetched = (url: string, body: string, status = 200, headers: Record<string, string> = {}): Fetched => ({
  url,
  finalUrl: url,
  status,
  headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  body,
  redirects: [],
  truncated: false,
});

export const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

export const GOOD_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acme Studio: fast marketing sites for SaaS</title>
<meta name="description" content="Acme Studio designs and builds fast marketing sites for small software companies, from brand to launch.">
<link rel="canonical" href="https://acme.dev/">
<meta property="og:title" content="Acme Studio"><meta property="og:description" content="Fast sites">
<meta property="og:image" content="https://acme.dev/og.jpg"><meta property="og:url" content="https://acme.dev/">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://acme.dev/#org', name: 'Acme Studio', url: 'https://acme.dev/' },
    { '@type': 'WebSite', name: 'Acme Studio', url: 'https://acme.dev/', publisher: { '@id': 'https://acme.dev/#org' } },
    { '@type': 'WebPage', name: 'Home', dateModified: new Date().toISOString() },
  ],
})}</script>
</head><body><h1>Fast marketing sites</h1><h2>Work</h2><p>${words(300)}</p><h2>Contact</h2><img src="a.jpg" alt="Team"></body></html>`;

export const LLMS = '# Acme Studio\n\n> Fast marketing sites.\n\n## Pages\n\n- [Home](https://acme.dev/): Start\n';
export const SITEMAP = '<?xml version="1.0"?><urlset><url><loc>https://acme.dev/</loc></url></urlset>';
export const ROBOTS = 'User-agent: *\nAllow: /\n\nSitemap: https://acme.dev/sitemap.xml\n';

export function inputs(over: Partial<AuditInputs> = {}): AuditInputs {
  return {
    page: fetched('https://acme.dev/', GOOD_HTML),
    robots: { ok: true, res: fetched('https://acme.dev/robots.txt', ROBOTS, 200, { 'content-type': 'text/plain' }) },
    llms: { ok: true, res: fetched('https://acme.dev/llms.txt', LLMS, 200, { 'content-type': 'text/plain' }) },
    llmsFull: { ok: true, res: fetched('https://acme.dev/llms-full.txt', `${LLMS}\n${words(100)}`, 200, { 'content-type': 'text/plain' }) },
    sitemap: { ok: true, res: fetched('https://acme.dev/sitemap.xml', SITEMAP, 200, { 'content-type': 'application/xml' }), source: 'robots' },
    ...over,
  };
}

