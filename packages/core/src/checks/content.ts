import { firstMeta, type PageModel } from '../html';
import { ENTITY_TYPES, nameOf, textValue } from '../jsonld';
import type { CheckResult } from '../types';
import { escapeHtml, pct, plural, result, truncate, type CheckContext, type Spec } from './shared';

/** The same test checkServerText fails on: an app shell, or almost no text in the initial HTML. */
export function serverTextFails(page: PageModel): boolean {
  const { wordCount, appShell, noscriptSaysEnableJs } = page;
  return appShell || (noscriptSaysEnableJs && wordCount < 150) || wordCount < 50;
}

export function checkServerText(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'server-rendered-text',
    category: 'content',
    title: 'Content is readable without JavaScript',
    weight: 4,
    why: 'Most AI crawlers do not run JavaScript; if the text only appears after hydration, they see an empty page.',
  };
  const { wordCount, appShell, noscriptSaysEnableJs } = ctx.page;
  const fix = {
    text: 'Render the main content on the server or at build time (SSR/SSG: Next.js, Astro, Nuxt, SvelteKit, or prerendering) so it is in the initial HTML.',
  };
  if (appShell || (noscriptSaysEnableJs && wordCount < 150)) {
    return result(spec, 'fail', `Looks like a client-side app shell: only ${plural(wordCount, 'word')} in the initial HTML.`, { fix });
  }
  if (wordCount < 50) return result(spec, 'fail', `Only ${plural(wordCount, 'word')} of text in the initial HTML.`, { fix });
  if (wordCount < 150) return result(spec, 'warn', `${wordCount} words of text in the initial HTML; thin for an assistant to quote.`, { fix: { text: 'Add a few clear paragraphs that say what the page offers, for whom, and why, in plain words.' } });
  return result(spec, 'pass', `${wordCount.toLocaleString('en-US')} words of text in the initial HTML.`);
}

export function checkH1(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'single-h1',
    category: 'content',
    title: 'One clear H1',
    weight: 2,
    why: 'The H1 is the strongest hint of what the page is about, for search engines and language models alike.',
  };
  const h1s = ctx.page.headings.filter((h) => h.level === 1);
  const fix = { text: 'Use exactly one `<h1>` that names the page topic; use `<h2>`–`<h3>` for sections.', snippet: `<h1>${escapeHtml(ctx.page.title?.split(/\s[|–—-]\s/)[0] ?? ctx.siteName)}</h1>`, lang: 'html' };
  if (!h1s.length) return result(spec, 'fail', 'No `<h1>` in the initial HTML.', { fix });
  if (h1s.length > 1) return result(spec, 'warn', `${h1s.length} H1s: ${h1s.slice(0, 3).map((h) => `"${truncate(h.text, 40)}"`).join(', ')}.`, { fix });
  if (!h1s[0]!.text) return result(spec, 'warn', 'The H1 is empty (or only an image without alt text).', { fix });
  return result(spec, 'pass', `H1: "${truncate(h1s[0]!.text, 80)}".`);
}

export function checkHeadingOrder(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'heading-order',
    category: 'content',
    title: 'Headings form an outline',
    weight: 1,
    why: 'A clean heading outline lets assistants split the page into sections and quote the right one.',
  };
  const hs = ctx.page.headings;
  if (hs.length < 2) {
    return result(spec, 'warn', `Only ${plural(hs.length, 'heading')}; there is no outline to follow.`, { fix: { text: 'Break the content into sections with `<h2>` headings that read like questions or topics.' } });
  }
  const skips: string[] = [];
  for (let i = 1; i < hs.length; i++) {
    if (hs[i]!.level > hs[i - 1]!.level + 1) skips.push(`h${hs[i - 1]!.level} → h${hs[i]!.level} ("${truncate(hs[i]!.text, 40)}")`);
  }
  if (skips.length) {
    return result(spec, 'warn', `${plural(skips.length, 'skipped heading level')} in ${hs.length} headings.`, {
      details: skips.slice(0, 8),
      fix: { text: 'Do not skip levels (h2 → h4). Style headings with CSS instead of picking a level for its size.' },
    }, Math.max(0.3, 1 - skips.length / hs.length));
  }
  return result(spec, 'pass', `${hs.length} headings in a consistent outline.`);
}

export function checkImgAlt(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'img-alt',
    category: 'content',
    title: 'Images have alt text',
    weight: 1,
    why: 'Alt text is the only way text-only crawlers and models know what an image shows.',
  };
  const imgs = ctx.page.images;
  if (!imgs.length) return result(spec, 'pass', 'No `<img>` elements in the initial HTML.');
  const missing = imgs.filter((i) => i.alt === null).length;
  const described = imgs.filter((i) => i.alt !== null).length;
  const ratio = described / imgs.length;
  const summary = `${described} of ${imgs.length} images have an alt attribute (${pct(ratio)}).`;
  if (!missing) return result(spec, 'pass', summary);
  const fix = { text: 'Describe meaningful images; use `alt=""` for purely decorative ones.', snippet: '<img src="/team.jpg" alt="The five-person design team in the Lisbon studio">', lang: 'html' };
  return result(spec, ratio >= 0.8 ? 'warn' : 'fail', summary, { fix }, ratio);
}

export function checkLang(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'lang',
    category: 'content',
    title: 'Language is declared',
    weight: 1,
    why: 'The `lang` attribute tells crawlers and models which language the page is in, which matters for multilingual answers.',
  };
  const lang = ctx.page.lang;
  const fix = { text: 'Set the language on the root element.', snippet: '<html lang="en">', lang: 'html' };
  if (!lang) return result(spec, 'fail', 'No `lang` attribute on `<html>`.', { fix });
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(lang)) return result(spec, 'warn', `\`lang="${lang}"\` is not a valid BCP 47 tag.`, { fix });
  return result(spec, 'pass', `\`<html lang="${lang}">\`.`);
}

function collectDates(ctx: CheckContext): { label: string; date: Date }[] {
  const out: { label: string; date: Date }[] = [];
  const add = (label: string, v: unknown) => {
    const s = textValue(v);
    if (!s) return;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) out.push({ label, date: d });
  };
  for (const n of ctx.jsonld.nodes) {
    add(`dateModified (${n.types[0]})`, n.data.dateModified);
    add(`datePublished (${n.types[0]})`, n.data.datePublished);
  }
  for (const k of ['article:modified_time', 'article:published_time', 'og:updated_time', 'last-modified', 'date']) {
    for (const v of ctx.page.meta.get(k) ?? []) add(`<meta ${k}>`, v);
  }
  return out;
}

export function checkFreshness(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'freshness',
    category: 'content',
    title: 'Freshness signals',
    weight: 1,
    why: 'Assistants prefer sources that show when they were published or last updated, especially for time-sensitive questions.',
  };
  const dates = collectDates(ctx);
  const fix = {
    text: 'Show a visible "Updated" date and mirror it in JSON-LD (`datePublished`, `dateModified`).',
    snippet: `<time datetime="${new Date().toISOString().slice(0, 10)}">Updated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>`,
    lang: 'html',
  };
  if (dates.length) {
    const latest = dates.reduce((a, b) => (b.date > a.date ? b : a));
    const ageDays = (Date.now() - latest.date.getTime()) / 86_400_000;
    const when = latest.date.toISOString().slice(0, 10);
    if (ageDays > 730) return result(spec, 'warn', `Latest date is ${when} (${latest.label}), over two years old.`, { fix: { text: 'Review and update the content, then bump `dateModified`.' } }, 0.6);
    return result(spec, 'pass', `Dated ${when} (${latest.label})${ctx.page.timeElements ? `, plus ${plural(ctx.page.timeElements, '<time> element')}` : ''}.`);
  }
  if (ctx.page.timeElements) return result(spec, 'pass', `${plural(ctx.page.timeElements, '<time datetime> element')} on the page.`);
  if (ctx.inputs.page.headers['last-modified']) {
    return result(spec, 'warn', 'Only an HTTP Last-Modified header; no date in the page or its structured data.', { fix });
  }
  return result(spec, 'warn', 'No publish or update date found in the page or its structured data.', { fix }, 0);
}

export function checkAuthorship(ctx: CheckContext): CheckResult {
  const spec: Spec = {
    id: 'authorship',
    category: 'content',
    title: 'Author or publisher is identified',
    weight: 1,
    why: 'Named, verifiable authors and publishers make content more trustworthy to cite (E-E-A-T).',
  };
  const signals: string[] = [];
  const author = ctx.jsonld.nodes.map((n) => nameOf(n.data.author, ctx.jsonld)).find(Boolean);
  if (author) signals.push(`JSON-LD author "${truncate(author, 40)}"`);
  const publisher = ctx.jsonld.nodes.map((n) => nameOf(n.data.publisher, ctx.jsonld)).find(Boolean);
  if (publisher) signals.push(`JSON-LD publisher "${truncate(publisher, 40)}"`);
  const entity = ctx.jsonld.nodes.find((n) => n.types.some((t) => ENTITY_TYPES.includes(t)) && textValue(n.data.name));
  if (entity && !author) signals.push(`${entity.types[0]} "${truncate(textValue(entity.data.name)!, 40)}" in JSON-LD`);
  const metaAuthor = firstMeta(ctx.page, 'author', 'article:author');
  if (metaAuthor) signals.push(`<meta name="author" content="${truncate(metaAuthor, 40)}">`);
  if (ctx.page.links.has('author') || /<a\b[^>]*\brel=["'][^"']*\bauthor\b/i.test(ctx.html)) signals.push('rel="author" link');
  if (signals.length) return result(spec, 'pass', `Found: ${signals.join(', ')}.`);
  return result(spec, 'warn', 'No author, publisher or organisation is named in the markup.', {
    fix: { text: 'Name who is behind the content: a visible byline plus `author` in JSON-LD (see the Structured data fixes) and a meta tag.', snippet: `<meta name="author" content="${escapeHtml(ctx.siteName)}">`, lang: 'html' },
  }, 0);
}
