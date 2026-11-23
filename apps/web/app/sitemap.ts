import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/insights';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/insights`, changeFrequency: 'weekly', priority: 0.8 },
    ...ARTICLES.map((a) => ({ url: `${SITE_URL}/insights/${a.slug}`, lastModified: a.updated ?? a.published, changeFrequency: 'monthly' as const, priority: 0.7 })),
  ];
}
