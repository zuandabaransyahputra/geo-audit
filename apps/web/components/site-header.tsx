import Link from 'next/link';
import { REPO_URL } from '@/lib/site';
import { Github, Logo } from './icons';
import { ThemeToggle } from './theme-toggle';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span>GEO Audit</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/insights" className="rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:text-foreground sm:px-3">
            Insights
          </Link>
          <Link href="/#checks" className="hidden rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground sm:block">
            What it checks
          </Link>
          <Link href="/#cli" className="hidden rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground sm:block">
            CLI
          </Link>
          <a
            href={REPO_URL}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Source code on GitHub"
            title="Source code on GitHub"
          >
            <Github />
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
