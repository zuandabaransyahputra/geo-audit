'use client';

import { useState } from 'react';
import { Arrow } from './icons';

export function UrlForm({ defaultValue = '', size = 'lg' }: { defaultValue?: string; size?: 'lg' | 'sm' }) {
  const [pending, setPending] = useState(false);
  const lg = size === 'lg';
  return (
    <form
      action="/report"
      method="get"
      onSubmit={() => setPending(true)}
      className={`flex w-full gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm transition focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15 ${lg ? 'max-w-xl' : 'max-w-md'}`}
    >
      <label htmlFor={`url-${size}`} className="sr-only">
        Website URL
      </label>
      <input
        id={`url-${size}`}
        name="url"
        type="text"
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={2048}
        defaultValue={defaultValue}
        placeholder="example.com"
        className={`min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground/70 ${lg ? 'text-base' : 'text-sm'}`}
      />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-70 ${lg ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-sm'}`}
      >
        {pending ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
            Auditing
          </>
        ) : (
          <>
            Audit <Arrow className="hidden sm:block" />
          </>
        )}
      </button>
    </form>
  );
}
