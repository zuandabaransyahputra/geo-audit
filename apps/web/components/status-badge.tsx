import type { Status } from '@geo-audit/core';
import { Alert, Check, Info, X } from './icons';

const STYLE: Record<Status, string> = {
  pass: 'bg-pass-soft text-pass',
  warn: 'bg-warn-soft text-warn',
  fail: 'bg-fail-soft text-fail',
  info: 'bg-info-soft text-info',
};
const LABEL: Record<Status, string> = { pass: 'Pass', warn: 'Warning', fail: 'Fail', info: 'Info' };

/** `notes`: a pass with caveats, shown in a neutral colour as "Pass · notes". */
export function StatusIcon({ status, notes = false }: { status: Status; notes?: boolean }) {
  const Icon = status === 'pass' ? Check : status === 'warn' ? Alert : status === 'fail' ? X : Info;
  const withNotes = notes && status === 'pass';
  const label = withNotes ? 'Pass · notes' : LABEL[status];
  return (
    <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full ${withNotes ? 'bg-muted text-muted-foreground' : STYLE[status]}`} title={label}>
      <Icon className="size-3.5" strokeWidth={2.5} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
