import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { ARTICLE_SLUGS, type ArticleSlug } from '@geo-audit/core';
import { Marked, type Tokens } from 'marked';

export interface ArticleMeta {
  slug: ArticleSlug;
  title: string;
  description: string;
  /** ISO date */
  published: string;
  updated?: string;
}

/** Order here is the order on /insights. Every slug in ARTICLE_SLUGS must appear exactly once. */
export const ARTICLES: ArticleMeta[] = [
  {
    slug: 'what-is-geo',
    title: 'What is GEO, and how is it different from SEO?',
    description: 'Generative engine optimisation explained: what changes when AI assistants answer instead of listing links, and what stays the same.',
    published: '2026-11-23',
  },
  {
    slug: 'ai-crawlers-robots-txt',
    title: 'AI crawlers in robots.txt: search bots vs training bots',
    description: 'Which AI crawlers exist, what each one is for, and how to allow AI search while blocking model training in robots.txt.',
    published: '2026-11-23',
  },
  {
    slug: 'llms-txt',
    title: 'llms.txt and llms-full.txt: what they are and how to write them',
    description: 'The llms.txt format, how llms-full.txt differs, how to write a useful one, and the mistakes that make it useless.',
    published: '2026-11-23',
  },
  {
    slug: 'json-ld-for-ai',
    title: 'The JSON-LD types that matter for AI answers',
    description: 'Organization, Person, WebSite, Article, Product, FAQPage and BreadcrumbList: which schema.org types to add and how to connect them.',
    published: '2026-11-23',
  },
  {
    slug: 'javascript-and-ai-crawlers',
    title: 'Making JavaScript-heavy sites readable for AI crawlers',
    description: 'Many AI crawlers do not run JavaScript. How to check what they see, and how SSR, static generation and prerendering fix it.',
    published: '2026-11-23',
  },
  {
    slug: 'writing-quotable-content',
    title: 'Writing content AI assistants can quote',
    description: 'Structure, facts, dates and named authors: how to write pages that assistants can understand, trust and cite accurately.',
    published: '2026-11-23',
  },
  {
    slug: 'seo-basics-for-ai-search',
    title: 'Why classic SEO basics still matter for AI search',
    description: 'AI search sits on top of search indexes. Status codes, HTTPS, titles, canonicals and sitemaps still decide whether you are in the running.',
    published: '2026-11-23',
  },
  {
    slug: 'measuring-ai-traffic',
    title: 'How to measure traffic from AI assistants',
    description: 'Track visits from ChatGPT, Perplexity, Claude, Gemini and Copilot with referrers, UTM tags and server logs, and know the blind spots.',
    published: '2026-11-23',
  },
  {
    slug: 'astro-llms-txt-json-ld',
    title: 'llms.txt and JSON-LD for Astro sites',
    description: 'Add llms.txt, llms-full.txt, JSON-LD and a sitemap to an Astro site, with an integration or by hand.',
    published: '2026-11-23',
  },
  {
    slug: 'geo-checklist',
    title: 'The GEO checklist: get found and cited by AI assistants',
    description: 'A practical checklist for AI search: crawler access, llms.txt, server-rendered content, structured data, SEO basics and measurement.',
    published: '2026-11-23',
  },
];

for (const slug of ARTICLE_SLUGS) {
  if (ARTICLES.filter((a) => a.slug === slug).length !== 1) throw new Error(`Article metadata missing or duplicated for ${slug}`);
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'insights');

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export interface Article extends ArticleMeta {
  markdown: string;
  html: string;
  toc: { id: string; text: string }[];
  words: number;
  readingMinutes: number;
}

export function readMarkdown(slug: ArticleSlug): string {
  return fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), 'utf8');
}

export function getArticle(slug: string): Article | undefined {
  const meta = ARTICLES.find((a) => a.slug === slug);
  if (!meta) return undefined;
  const markdown = readMarkdown(meta.slug);
  const toc: Article['toc'] = [];
  const used = new Set<string>();

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        let id = slugify(token.text) || `section-${used.size + 1}`;
        while (used.has(id)) id += '-2';
        used.add(id);
        if (token.depth === 2) toc.push({ id, text: inner.replace(/<[^>]+>/g, '') });
        return `<h${token.depth} id="${id}"><a href="#${id}" class="anchor" aria-hidden="true" tabindex="-1">#</a>${inner}</h${token.depth}>\n`;
      },
      link(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Link) {
        const inner = this.parser.parseInline(token.tokens);
        const external = /^https?:\/\//.test(token.href);
        return `<a href="${token.href}"${external ? ' rel="noopener"' : ''}>${inner}</a>`;
      },
    },
  });
  const html = marked.parse(markdown, { async: false }) as string;
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return { ...meta, markdown, html, toc, words, readingMinutes: Math.max(1, Math.round(words / 220)) };
}

export function allArticles(): Article[] {
  return ARTICLES.map((a) => getArticle(a.slug)!);
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
