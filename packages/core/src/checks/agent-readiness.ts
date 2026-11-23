import { ASTRO_GEO_URL } from '../constants';
import { looksLikeHtml, validateLlmsTxt } from '../llms';
import type { CheckResult } from '../types';
import { plural, result, type CheckContext, type Spec } from './shared';

export function checkLlmsTxt(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'llms-txt',
    category: 'ai-access',
    title: 'llms.txt is present and well formed',
    weight: 2,
    why: 'llms.txt gives assistants a short, curated Markdown map of your site instead of making them guess from navigation.',
  };
  const astro = ctx.page.isAstro
    ? ` On Astro, [astro-geo](${ASTRO_GEO_URL}) generates llms.txt and llms-full.txt from your pages at build time.`
    : '';
  const sample = [
    `# ${ctx.siteName}`,
    '',
    `> ${ctx.description ?? `One or two sentences on what ${ctx.siteName} is and who it is for.`}`,
    '',
    '## Pages',
    '',
    `- [Home](${ctx.url.origin}/): What you do, in one line`,
    `- [About](${ctx.url.origin}/about): Who is behind it`,
    `- [Contact](${ctx.url.origin}/contact): How to reach you`,
    '',
    '## Optional',
    '',
    `- [Blog](${ctx.url.origin}/blog): Articles and updates`,
  ].join('\n');
  const fix = { text: `Add ${ctx.url.origin}/llms.txt, a plain-text Markdown file.${astro} A starting point:`, snippet: sample, lang: 'md' };
  const f = ctx.inputs.llms;
  if (!f.ok) return result(spec, 'fail', `llms.txt could not be fetched (${f.error}).`, { fix });
  if (f.res.status !== 200) return result(spec, 'fail', `No llms.txt (HTTP ${f.res.status}).`, { fix });
  if (!f.res.body.trim()) return result(spec, 'fail', 'llms.txt is empty or not served as text.', { fix });
  const v = validateLlmsTxt(f.res.body);
  if (looksLikeHtml(f.res.body)) return result(spec, 'fail', '/llms.txt returns an HTML page, not a Markdown file.', { fix });
  if (!v.valid) return result(spec, 'warn', `llms.txt found but invalid: ${v.errors.join(' ')}`, { details: [...v.warnings, ...v.notes], fix }, 0.4);
  if (v.warnings.length) {
    return result(
      spec,
      'warn',
      `llms.txt found ("${v.title}", ${plural(v.sections.length, 'section')}, ${plural(v.linkCount, 'link')}) with ${plural(v.warnings.length, 'issue')}.`,
      { details: [...v.warnings, ...v.notes], fix: { text: `Tidy it up so it follows the llmstxt.org format.${astro} The expected shape:`, snippet: sample, lang: 'md' } },
      v.linkCount ? 0.8 : 0.6,
    );
  }
  return result(spec, 'pass', `llms.txt found: "${v.title}", ${plural(v.sections.length, 'section')}, ${plural(v.linkCount, 'link')}.`, v.notes.length ? { details: v.notes } : {});
}

export function checkLlmsFull(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'llms-full-txt',
    category: 'ai-access',
    title: 'llms-full.txt is available',
    weight: 1,
    why: 'llms-full.txt hands assistants your key content in one clean Markdown file, so they quote you accurately.',
  };
  const fix = {
    text: ctx.page.isAstro
      ? `Publish ${ctx.url.origin}/llms-full.txt with the readable text of your main pages. [astro-geo](${ASTRO_GEO_URL}) can generate it (\`llms: { full: true }\`).`
      : `Publish ${ctx.url.origin}/llms-full.txt with the readable text of your main pages as Markdown (most docs tools and static site generators can export this).`,
  };
  const f = ctx.inputs.llmsFull;
  if (!f.ok) return result(spec, 'warn', `llms-full.txt could not be fetched (${f.error}).`, { fix }, 0);
  if (f.res.status !== 200 || !f.res.body.trim() || looksLikeHtml(f.res.body)) {
    return result(spec, 'warn', f.res.status === 200 ? '/llms-full.txt is not a Markdown file.' : `No llms-full.txt (HTTP ${f.res.status}).`, { fix }, 0);
  }
  const kb = Math.round(Buffer.byteLength(f.res.body) / 1024);
  return result(spec, 'pass', `llms-full.txt found (${f.res.truncated ? 'over ' : ''}${kb} KB).`);
}
