import { isScored, type Report } from '@geo-audit/core';
import { AUTHOR_NAME, HIRE_URL } from '@/lib/site';
import { Arrow } from './icons';

type Variant = 'clean' | 'js' | 'jsonld' | 'access' | 'default';

const ACCESS_IDS = new Set(['ai-search-bots', 'robots-txt', 'firewall-probe']);

/** Which pitch fits the report: what its biggest problem is, or that there is none. */
export function hireVariant(report: Report): Variant {
  const scored = report.categories.filter(isScored).flatMap((c) => c.checks);
  if (report.score >= 90 && !scored.some((c) => c.status === 'fail' || c.status === 'warn')) return 'clean';
  const plan = report.insights.plan;
  const top = [...plan.quickWins, ...plan.thisWeek, ...plan.bigger].sort((a, b) => b.points - a.points)[0];
  if (!top) return 'default';
  if (top.id === 'server-rendered-text') return 'js';
  if (top.category === 'structured-data') return 'jsonld';
  if (ACCESS_IDS.has(top.id)) return 'access';
  return 'default';
}

const COPY: Record<Variant, { heading: string; body: string; button: string }> = {
  clean: {
    heading: 'Your page is in good shape',
    body: "If you want the rest of the site checked, or help with a new build in Next.js or Astro, I'm available for freelance work.",
    button: 'Get in touch',
  },
  js: {
    heading: 'Content hidden behind JavaScript?',
    body: 'I move client-rendered pages to server rendering in Next.js or Astro, usually without a redesign.',
    button: 'Hire me',
  },
  jsonld: {
    heading: 'Need the JSON-LD done properly?',
    body: "I can add structured data that matches your content and passes Google's checks.",
    button: 'Hire me',
  },
  access: {
    heading: 'Crawlers blocked and not sure why?',
    body: 'I can go through your robots.txt, CDN and firewall rules and open them up for the assistants you want.',
    button: 'Hire me',
  },
  default: {
    heading: 'Need help fixing these?',
    body: `I'm ${AUTHOR_NAME}, a freelance web developer. I build fast, AI-ready sites in Next.js and Astro, and I can work through this report with you: crawler rules, llms.txt, structured data and server rendering.`,
    button: 'Hire me',
  },
};

export function HireCta({ variant = 'default' }: { variant?: Variant }) {
  const c = COPY[variant];
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="max-w-xl">
        <p className="font-semibold">{c.heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
      </div>
      <a
        href={HIRE_URL}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        {c.button} <Arrow />
      </a>
    </aside>
  );
}
