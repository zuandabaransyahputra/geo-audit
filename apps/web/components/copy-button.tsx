'use client';

import { useState } from 'react';
import { Check, Copy } from './icons';

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  className = '',
  icon,
  variant = 'ghost',
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  icon?: React.ReactNode;
  variant?: 'ghost' | 'outline' | 'solid';
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const value = text === '__LOCATION__' ? window.location.href : text;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const styles =
    variant === 'solid'
      ? 'bg-primary text-primary-foreground hover:opacity-90'
      : variant === 'outline'
        ? 'border border-border bg-card hover:bg-muted'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground';
  return (
    <button type="button" onClick={copy} className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition ${styles} ${className}`} aria-live="polite">
      {copied ? <Check className="size-3.5" /> : (icon ?? <Copy className="size-3.5" />)}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
