export { SITE_URL, REPO_URL, AUTHOR_NAME, AUTHOR_URL, HIRE_URL, ASTRO_GEO_URL, VERSION } from '@geo-audit/core';

export const EXAMPLES = ['zuanda.web.id', 'vercel.com', 'astro.build', 'nextjs.org'];

export function reportHref(url: string): string {
  return `/report?url=${encodeURIComponent(url)}`;
}
