import { AUTHOR_NAME, AUTHOR_URL, HIRE_URL, REPO_URL, VERSION } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Built by{' '}
          <a href={AUTHOR_URL} className="font-medium text-foreground underline-offset-4 hover:underline">
            {AUTHOR_NAME}
          </a>
          . Need help fixing your report?{' '}
          <a href={HIRE_URL} className="font-medium text-primary underline-offset-4 hover:underline">
            Hire me
          </a>
          .
        </p>
        <p className="flex gap-4">
          <a href={REPO_URL} className="hover:text-foreground">
            Open source (MIT)
          </a>
          <span>v{VERSION}</span>
        </p>
      </div>
    </footer>
  );
}
