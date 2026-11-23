import type { Status } from '@geo-audit/core';
import { Alert, Check, Info, X } from './icons';

const STYLE: Record<Status, string> = {
  pass: 'bg-pass-soft text-pass',
  warn: 'bg-warn-soft text-warn',
  fail: 'bg-fail-soft text-fail',
  info: 'bg-info-soft text-info',
};
const LABEL: Record<Status, string> = { pass: 'Pass', warn: 'Warning', fail: 'Fail', info: 'Info' };

export function StatusIcon({ status }: { status: Status }) {
  const Icon = status === 'pass' ? Check : status === 'warn' ? Alert : status === 'fail' ? X : Info;
  return (
    <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full ${STYLE[status]}`} title={LABEL[status]}>
      <Icon className="size-3.5" strokeWidth={2.5} />
      <span className="sr-only">{LABEL[status]}</span>
    </span>
  );
}
