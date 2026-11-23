import { AUTHOR_NAME, HIRE_URL } from '@/lib/site';
import { Arrow } from './icons';

export function HireCta() {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="max-w-xl">
        <p className="font-semibold">Need help fixing these?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          I&apos;m {AUTHOR_NAME}, a freelance web developer. I build fast, AI-ready sites in Next.js and Astro, and I can work
          through this report with you: crawler rules, llms.txt, structured data and server rendering.
        </p>
      </div>
      <a
        href={HIRE_URL}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Hire me <Arrow />
      </a>
    </aside>
  );
}
