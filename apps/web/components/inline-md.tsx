import { Fragment } from 'react';

/** Render the tiny subset of Markdown used in check text: [links](url) and `code`. */
export function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)\s]+\)|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
        if (link && /^https?:\/\//.test(link[2]!)) {
          return (
            <a key={i} href={link[2]} className="font-medium text-primary underline-offset-4 hover:underline" rel="noopener">
              {link[1]}
            </a>
          );
        }
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              {p.slice(1, -1)}
            </code>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
