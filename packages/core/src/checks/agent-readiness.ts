import { ASTRO_GEO_URL } from '../constants';
import { lighthouseLlmsProblems, looksLikeHtml, validateLlmsTxt } from '../llms';
import { list } from '../products';
import type { CheckResult } from '../types';
import { plural, result, type CheckContext, type Spec } from './shared';

export function checkLlmsTxt(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'llms-txt',
    category: 'agent-readiness',
    title: 'llms.txt',
    weight: 1,
    why: 'Optional. Some agents and developer tools read llms.txt as a curated map of the site. Google Search ignores it, so it neither helps nor hurts there.',
  };
  const astro = ctx.page.isAstro
    ? ` On Astro, [astro-geo](${ASTRO_GEO_URL}) generates llms.txt and llms-full.txt from your pages at build time.`
    : '';
  const sample = llmsTemplate(ctx);
  const fix = { text: `If you want to offer one, add ${ctx.url.origin}/llms.txt, a plain-text Markdown file.${astro} A starting point built from your navigation and sitemap:`, snippet: sample, lang: 'md' };
  const f = ctx.inputs.llms;
  if (!f.ok) return result(spec, 'info', `No llms.txt (${f.error}). It is optional.`, { fix });
  const status = f.res.status;
  if (status >= 500 || status === 429) {
    return result(spec, 'warn', `/llms.txt answers HTTP ${status}.`, { fix: { text: 'Return the file with HTTP 200, or a plain 404 if you do not publish one. Server errors make tools retry or give up.' } });
  }
  if (status !== 200) return result(spec, 'info', `No llms.txt (HTTP ${status}). It is optional.`, { fix });
  const body = f.res.body;
  if (!body.trim()) return result(spec, 'warn', '/llms.txt is empty.', { fix });
  if (looksLikeHtml(body)) return result(spec, 'warn', '/llms.txt returns an HTML page, not a Markdown file.', { fix });
  const v = validateLlmsTxt(body);
  const style = [...v.errors, ...v.warnings, ...v.notes];
  const problems = lighthouseLlmsProblems(body);
  if (problems.length) {
    return result(spec, 'warn', `llms.txt found but ${list(problems)}.`, { details: style, fix: { text: `Lighthouse expects an H1, at least one link and some content.${astro} The expected shape:`, snippet: sample, lang: 'md' } }, 0.5);
  }
  const shape = `"${v.title ?? lighthouseTitle(body)}", ${plural(v.sections.length, 'section')}, ${plural(v.linkCount || countLinks(body), 'link')}`;
  return result(spec, 'pass', `llms.txt found: ${shape}.`, style.length ? { notes: style } : {});
}

const countLinks = (s: string) => (s.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
const lighthouseTitle = (s: string) => /^\s*#\s+(.+)$/m.exec(s)?.[1]?.trim() ?? '';

/** An llms.txt starting point from the page's own navigation and sitemap; placeholders only as a last resort. */
export function llmsTemplate(ctx: CheckContext): string {
  const links = siteLinks(ctx);
  const lines = [`# ${ctx.siteName}`, '', `> ${ctx.description ?? `One or two sentences on what ${ctx.siteName} is and who it is for.`}`, '', '## Pages', ''];
  if (links.length) {
    for (const l of links) lines.push(`- [${l.title}](${l.url})`);
  } else {
    lines.push('<!-- replace: links to your most important pages -->');
    lines.push(`- [Home](${ctx.url.origin}/): What you do, in one line`);
    lines.push(`- [About](${ctx.url.origin}/about): Who is behind it`);
    lines.push(`- [Contact](${ctx.url.origin}/contact): How to reach you`);
  }
  return lines.join('\n');
}

/** Same-origin links from nav/header, then up to 10 sitemap URLs (urlset only), short paths first, no duplicates. */
export function siteLinks(ctx: CheckContext, max = 20): { title: string; url: string }[] {
  const origin = ctx.url.origin;
  const seen = new Set<string>();
  const out: { title: string; url: string }[] = [];
  const key = (u: URL) => `${u.origin}${u.pathname.replace(/\/$/, '') || '/'}`;
  const add = (href: string, title: string) => {
    let u: URL;
    try {
      u = new URL(href, ctx.url);
    } catch {
      return;
    }
    if (u.origin !== origin || !/^https?:$/.test(u.protocol)) return;
    u.hash = '';
    const k = key(u);
    if (seen.has(k) || !title) return;
    seen.add(k);
    out.push({ title: title.replace(/[[\]]/g, ''), url: u.href });
  };
  for (const a of ctx.page.anchors.filter((x) => x.inNav)) add(a.href, a.text);
  const sm = ctx.inputs.sitemap;
  if (sm.ok && sm.res.status === 200 && /<urlset[\s>]/i.test(sm.res.body)) {
    const locs = [...sm.res.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.replace(/&amp;/g, '&'));
    const sorted = locs
      .map((l) => {
        try {
          return new URL(l);
        } catch {
          return null;
        }
      })
      .filter((u): u is URL => Boolean(u) && u!.origin === origin)
      .sort((a, b) => a.pathname.length - b.pathname.length);
    let n = 0;
    for (const u of sorted) {
      if (n >= 10) break;
      if (seen.has(key(u))) continue;
      add(u.href, titleFromPath(u));
      n++;
    }
  }
  return out.slice(0, max);
}

function titleFromPath(u: URL): string {
  const seg = u.pathname.split('/').filter(Boolean).pop();
  if (!seg) return 'Home';
  const words = decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Home';
}

export function checkLlmsFull(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'llms-full-txt',
    category: 'agent-readiness',
    title: 'llms-full.txt',
    weight: 1,
    why: 'Optional. llms-full.txt hands tools your key content as one clean Markdown file.',
  };
  const fix = {
    text: ctx.page.isAstro
      ? `If you want to offer one, publish ${ctx.url.origin}/llms-full.txt with the readable text of your main pages. [astro-geo](${ASTRO_GEO_URL}) can generate it (\`llms: { full: true }\`).`
      : `If you want to offer one, publish ${ctx.url.origin}/llms-full.txt with the readable text of your main pages as Markdown (most docs tools and static site generators can export this).`,
  };
  const f = ctx.inputs.llmsFull;
  if (!f.ok) return result(spec, 'info', `No llms-full.txt (${f.error}). It is optional.`, { fix });
  if (f.res.status !== 200) return result(spec, 'info', `No llms-full.txt (HTTP ${f.res.status}). It is optional.`, { fix });
  if (!f.res.body.trim() || looksLikeHtml(f.res.body)) return result(spec, 'warn', '/llms-full.txt is not a Markdown file.', { fix });
  const kb = Math.round(Buffer.byteLength(f.res.body) / 1024);
  return result(spec, 'pass', `llms-full.txt found (${f.res.truncated ? 'over ' : ''}${kb} KB).`);
}

export function checkInteractiveNames(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'interactive-names',
    category: 'agent-readiness',
    title: 'Buttons, links and form fields have names',
    weight: 1,
    why: 'Agents that act on a page (and screen readers) find controls by their accessible name; an unnamed button is a guess.',
  };
  const { total, unnamed } = ctx.page.controls;
  if (!total) return result(spec, 'pass', 'No buttons, links or form fields in the initial HTML.', { vacuous: true });
  if (!unnamed.length) return result(spec, 'pass', `All ${plural(total, 'button, link and form field', 'buttons, links and form fields')} have a name.`);
  return result(
    spec,
    'warn',
    `${unnamed.length} of ${plural(total, 'control')} have no accessible name.`,
    {
      details: unnamed.slice(0, 8),
      fix: {
        text: 'Give every control a name: visible text, a `<label>` for form fields, or `aria-label` for icon-only buttons and links.',
        snippet: '<button type="button" aria-label="Open menu">\n  <svg aria-hidden="true">…</svg>\n</button>\n\n<label for="email">Email</label>\n<input id="email" type="email">',
        lang: 'html',
      },
    },
    1 - unnamed.length / total,
  );
}

export function checkWebMcp(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'webmcp-declarative',
    category: 'agent-readiness',
    title: 'Declarative WebMCP tools',
    weight: 0,
    why: 'Chrome\'s declarative WebMCP API turns a form with `toolname` and `tooldescription` into a tool an in-browser agent can call.',
  };
  const { total, tools, partial } = ctx.page.forms;
  const details = partial ? [`${plural(partial, 'form')} with only one of \`toolname\` and \`tooldescription\`; both are required.`] : [];
  if (tools.length) {
    return result(spec, 'info', `${plural(tools.length, 'tool')} found: ${tools.slice(0, 6).map((t) => `\`${t}\``).join(', ')}.`, details.length ? { details } : {});
  }
  if (!total) return result(spec, 'info', 'None (no forms in the initial HTML).');
  return result(spec, 'info', `None. ${plural(total, 'form')} without WebMCP attributes.`, {
    ...(details.length ? { details } : {}),
    fix: {
      text: 'Optional and experimental: name a form as a tool so agents in Chrome can fill and submit it.',
      snippet: '<form toolname="contactRequest" tooldescription="Sends a message to the team.">\n  …\n</form>',
      lang: 'html',
    },
  });
}
