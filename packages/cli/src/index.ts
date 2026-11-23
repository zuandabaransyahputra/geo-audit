import { parseArgs } from 'node:util';
import {
  articleUrl,
  audit,
  BlockedUrlError,
  FetchError,
  HIRE_URL,
  reportUrl,
  points,
  toMarkdown,
  VERSION,
  type ActionItem,
  type CheckResult,
  type Report,
  type Status,
  type Visibility,
} from '@geo-audit/core';

const HELP = `
geo-audit ${VERSION}: how well can AI search and assistants find, read and cite a site?

Usage
  npx ai-geo-audit <url> [options]

Options
  --json             Print the full report as JSON
  --markdown, --md   Print the report as Markdown
  --all              Show details and fixes for passing checks too
  --min-score <n>    Exit with code 1 when the score is below n (for CI)
  --no-color         Disable colours (NO_COLOR is respected too)
  -h, --help         Show this help
  -v, --version      Show the version

Examples
  npx ai-geo-audit example.com
  npx ai-geo-audit https://example.com/blog/post --min-score 80
`;

function main(): Promise<number> {
  let args;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        json: { type: 'boolean' },
        markdown: { type: 'boolean' },
        md: { type: 'boolean' },
        all: { type: 'boolean' },
        'min-score': { type: 'string' },
        'no-color': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n${HELP}`);
    return Promise.resolve(2);
  }
  const { values, positionals } = args;
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return Promise.resolve(0);
  }
  if (values.help || !positionals[0]) {
    process.stdout.write(HELP);
    return Promise.resolve(values.help ? 0 : 2);
  }
  const minScore = values['min-score'] === undefined ? undefined : Number(values['min-score']);
  if (minScore !== undefined && !Number.isFinite(minScore)) {
    process.stderr.write('--min-score must be a number\n');
    return Promise.resolve(2);
  }
  const color = !values['no-color'] && !process.env.NO_COLOR && Boolean(process.stdout.isTTY);
  return run(positionals[0], { json: values.json, markdown: values.markdown || values.md, all: values.all, color, minScore });
}

interface RunOptions {
  json?: boolean;
  markdown?: boolean;
  all?: boolean;
  color: boolean;
  minScore?: number;
}

async function run(url: string, o: RunOptions): Promise<number> {
  const c = palette(o.color);
  const interactive = !o.json && !o.markdown && process.stderr.isTTY;
  if (interactive) process.stderr.write(c.dim(`Auditing ${url} ...\n`));
  let report: Report;
  try {
    report = await audit(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const kind = err instanceof BlockedUrlError ? 'Not allowed' : err instanceof FetchError ? 'Could not fetch the page' : 'Error';
    process.stderr.write(`${c.red(`${kind}:`)} ${msg}\n`);
    return 1;
  }
  if (o.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else if (o.markdown) process.stdout.write(toMarkdown(report));
  else process.stdout.write(render(report, o, c));
  if (o.minScore !== undefined && report.score < o.minScore) {
    if (!o.json && !o.markdown) process.stderr.write(c.red(`Score ${report.score} is below --min-score ${o.minScore}.\n`));
    return 1;
  }
  return 0;
}

type Paint = (s: string) => string;
function palette(on: boolean) {
  const wrap = (open: number, close: number): Paint => (s) => (on ? `\x1b[${open}m${s}\x1b[${close}m` : s);
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    blue: wrap(34, 39),
    cyan: wrap(36, 39),
    gray: wrap(90, 39),
  };
}
type Palette = ReturnType<typeof palette>;

function scoreColor(c: Palette, score: number): Paint {
  return score >= 80 ? c.green : score >= 55 ? c.yellow : c.red;
}

function bar(score: number, width = 20): string {
  const full = Math.round((score / 100) * width);
  return '█'.repeat(full) + '░'.repeat(width - full);
}

function icon(c: Palette, s: Status): string {
  return s === 'pass' ? c.green('✓') : s === 'warn' ? c.yellow('!') : s === 'fail' ? c.red('✗') : c.blue('i');
}

function visIcon(c: Palette, v: Visibility): string {
  return v === 'visible' ? c.green('● visible') : v === 'partly' ? c.yellow('◐ partly ') : c.red('○ blocked');
}

function wrap(text: string, width: number, pad: string): string {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(pad + line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(pad + line);
  return lines.join('\n');
}

function indent(text: string, pad: string): string {
  return text
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}

/** Turn inline Markdown links into "text (url)" for the terminal. */
function plain(s: string): string {
  return s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/`([^`]+)`/g, '$1');
}

function renderCheck(check: CheckResult, o: RunOptions, c: Palette): string {
  const lines = [`  ${icon(c, check.status)} ${c.bold(check.title)}`, `    ${plain(check.summary)}`];
  const expand = o.all || check.status === 'fail' || check.status === 'warn';
  if (!expand) return lines.join('\n');
  if (check.details?.length && (check.status !== 'pass' || o.all)) {
    const shown = check.details.filter((d) => o.all || !/^allowed\s/.test(d));
    for (const d of shown.slice(0, 12)) lines.push(c.gray(`      · ${d}`));
  }
  if (check.status !== 'pass' && check.status !== 'info') {
    lines.push(c.dim(`    Why: ${check.why}`));
    if (check.fix) {
      lines.push(`    ${c.cyan('Fix:')} ${plain(check.fix.text)}`);
      if (check.fix.snippet) lines.push(c.gray(indent(check.fix.snippet, '      ')));
    }
  }
  return lines.join('\n');
}

function render(r: Report, o: RunOptions, c: Palette): string {
  const out: string[] = [];
  const sc = scoreColor(c, r.score);
  out.push('');
  out.push(`${c.bold('GEO Audit')}  ${r.domain}`);
  const redirects = r.page.redirects.length ? `  ·  ${r.page.redirects.length} redirect${r.page.redirects.length > 1 ? 's' : ''}` : '';
  out.push(c.dim(`${r.finalUrl}  ·  HTTP ${r.page.status}${redirects}  ·  ${(r.durationMs / 1000).toFixed(1)} s`));
  out.push('');
  out.push(`  Score  ${sc(c.bold(`${r.score}/100`))}  grade ${sc(c.bold(r.grade))}`);
  out.push('');
  const labelWidth = Math.max(...r.categories.map((x) => x.label.length));
  for (const cat of r.categories) {
    const col = scoreColor(c, cat.score);
    out.push(`  ${cat.label.padEnd(labelWidth)}  ${col(bar(cat.score))}  ${col(String(cat.score).padStart(3))}  ${c.gray(`${Math.round(cat.weight * 100)}%`)}`);
  }
  const ins = r.insights;
  out.push('');
  out.push(wrap(ins.summary, 90, '  '));

  out.push('');
  out.push(c.bold('Who can see you'));
  const pw = Math.max(...ins.visibility.map((v) => v.product.length));
  for (const v of ins.visibility) {
    out.push(`  ${visIcon(c, v.status)} ${v.product.padEnd(pw)}  ${c.gray(v.reason)}`);
  }

  for (const cat of r.categories) {
    out.push('');
    out.push(`${c.bold(cat.label)} ${c.gray(`${cat.score}/100`)}`);
    for (const check of cat.checks) out.push(renderCheck(check, o, c));
  }

  const plan = ins.plan;
  const groups: [string, ActionItem[]][] = [
    ['Quick wins (minutes)', plan.quickWins],
    ['This week (hours)', plan.thisWeek],
    ['Bigger projects (days)', plan.bigger],
  ];
  if (groups.some(([, items]) => items.length)) {
    out.push('');
    out.push(c.bold('Action plan') + c.gray('  (points and effort are estimates)'));
    for (const [label, items] of groups) {
      if (!items.length) continue;
      out.push(`  ${c.cyan(label)}`);
      for (const f of items) out.push(`    · ${f.title} ${c.green(`+${points(f.points)}`)} ${c.gray(`· ${f.effortLabel}${f.learnMore ? ` · ${articleUrl(f.learnMore)}` : ''}`)}`);
    }
    const proj = [`now ${plan.current}`];
    if (plan.quickWins.length) proj.push(`after quick wins ~${plan.afterQuickWins}`);
    proj.push(`after full plan ~${plan.afterAll}`);
    out.push(`  Projected score: ${proj.join(' → ')}`);
  }
  if (ins.strengths.length) {
    out.push('');
    out.push(c.bold('Strengths'));
    for (const s of ins.strengths) out.push(`  ${c.green('+')} ${s}`);
  }
  out.push('');
  out.push(`Shareable report: ${c.cyan(reportUrl(r.url))}`);
  out.push(c.dim(`Built by Zuanda Baransyah Putra. Need help fixing these? ${HIRE_URL}`));
  out.push('');
  return out.join('\n');
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : err}\n`);
    process.exitCode = 1;
  },
);
