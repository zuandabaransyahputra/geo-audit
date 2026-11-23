import { parse, type HTMLElement } from 'node-html-parser';

export interface PageModel {
  lang?: string;
  title?: string;
  /** meta name/property (lower-cased) -> contents */
  meta: Map<string, string[]>;
  /** link rel (lower-cased, each token) -> hrefs */
  links: Map<string, string[]>;
  headings: { level: number; text: string }[];
  images: { alt: string | null; decorative: boolean }[];
  /** Visible text of the initial HTML, whitespace collapsed. */
  text: string;
  wordCount: number;
  jsonLd: string[];
  microdataTypes: string[];
  rdfaTypes: string[];
  timeElements: number;
  generator?: string;
  isAstro: boolean;
  /** Looks like an empty client-side app shell (#root/#__next/#app with no content). */
  appShell: boolean;
  noscriptSaysEnableJs: boolean;
  scriptCount: number;
  hasViewport: boolean;
  /** Visible buttons, links and form fields in the initial HTML, and short descriptions of unnamed ones. */
  controls: { total: number; unnamed: string[] };
  /** `<a href>` links in document order; `inNav` when inside `<nav>` or `<header>`. Text is capped at 80 chars. */
  anchors: { href: string; text: string; inNav: boolean }[];
  /** Forms, and declarative WebMCP tools (`<form toolname tooldescription>`). */
  forms: { total: number; tools: string[]; partial: number };
}

const REMOVE = 'script, style, noscript, template, svg, iframe, object, canvas, head';

/** Count words; CJK/Thai characters count individually since they aren't space separated. */
export function countWords(text: string): number {
  const cjk = text.match(/[぀-ヿ㐀-鿿가-힯฀-๿]/g)?.length ?? 0;
  const rest = text.replace(/[぀-ヿ㐀-鿿가-힯฀-๿]/g, ' ');
  const words = rest.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return words + Math.round(cjk / 2);
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

export function parsePage(html: string): PageModel {
  const root = parse(html, {
    comment: false,
    lowerCaseTagName: true,
    blockTextElements: { script: true, style: true, noscript: true, pre: true, textarea: true },
  });

  const htmlEl = root.querySelector('html');
  const lang = htmlEl?.getAttribute('lang')?.trim() || undefined;
  const title = root.querySelector('title')?.text.replace(/\s+/g, ' ').trim() || undefined;

  const meta = new Map<string, string[]>();
  let hasViewport = false;
  for (const m of root.querySelectorAll('meta')) {
    const key = (m.getAttribute('name') ?? m.getAttribute('property') ?? m.getAttribute('http-equiv') ?? '').trim().toLowerCase();
    const content = m.getAttribute('content');
    if (!key || content === undefined) continue;
    push(meta, key, content.trim());
    if (key === 'viewport') hasViewport = true;
  }

  const links = new Map<string, string[]>();
  for (const l of root.querySelectorAll('link')) {
    const rel = (l.getAttribute('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const href = l.getAttribute('href');
    if (!href) continue;
    for (const r of rel) push(links, r, href.trim());
  }

  const jsonLd: string[] = [];
  let scriptCount = 0;
  for (const s of root.querySelectorAll('script')) {
    const type = (s.getAttribute('type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (type === 'application/ld+json') jsonLd.push(s.textContent ?? s.rawText);
    else if (!type || type === 'module' || type.includes('javascript')) scriptCount++;
  }

  const noscriptText = root
    .querySelectorAll('noscript')
    .map((n) => n.textContent ?? '')
    .join(' ');
  const noscriptSaysEnableJs = /(enable|turn on|need|requires?)\s+(java)?script/i.test(noscriptText) || /javascript\s+(is\s+)?(required|disabled)/i.test(noscriptText);

  const microdataTypes = root
    .querySelectorAll('[itemscope]')
    .map((e) => e.getAttribute('itemtype') ?? '')
    .filter(Boolean);
  const rdfaTypes = root
    .querySelectorAll('[typeof]')
    .map((e) => e.getAttribute('typeof') ?? '')
    .filter(Boolean);
  const timeElements = root.querySelectorAll('time[datetime]').length;

  const generator = meta.get('generator')?.[0];
  const isAstro = /astro/i.test(generator ?? '') || /["'(]\/_astro\//.test(html) || /<astro-island[\s>]/.test(html);

  const body = root.querySelector('body') ?? root;
  // Detect an app shell before stripping: a mount point with no meaningful content.
  const mount = body.querySelector('#root, #__next, #app, #__nuxt, #___gatsby, [data-reactroot], app-root');
  const images: PageModel['images'] = body.querySelectorAll('img').map((img) => {
    const alt = img.getAttribute('alt');
    const role = img.getAttribute('role');
    const hidden = img.getAttribute('aria-hidden') === 'true';
    return { alt: alt === undefined ? null : alt, decorative: alt === '' || role === 'presentation' || role === 'none' || hidden };
  });

  const controls = scanControls(root, body);
  const anchors = collectAnchors(body);
  const forms = scanForms(body);

  body.querySelectorAll(REMOVE).forEach((n) => n.remove());
  // Accessible name of a heading: aria-label wins (split-text animations hide the words with aria-hidden),
  // then visible text, then the alt text of images inside it.
  const headingEls = body.querySelectorAll('h1, h2, h3, h4, h5, h6').map((h: HTMLElement) => ({
    el: h,
    level: Number(h.tagName.slice(1)),
    label: h.getAttribute('aria-label')?.trim(),
    alt: h.querySelectorAll('img[alt]').map((i) => i.getAttribute('alt') ?? '').join(' ').trim(),
  }));
  body.querySelectorAll('[hidden], [aria-hidden="true"]').forEach((n) => n.remove());
  const headings = headingEls.map(({ el, level, label, alt }) => ({
    level,
    text: (label || el.textContent.replace(/\s+/g, ' ').trim() || alt).replace(/\s+/g, ' ').trim(),
  }));

  const text = body.textContent.replace(/\s+/g, ' ').trim();
  const wordCount = countWords(text);
  const mountWords = mount ? countWords(mount.textContent) : 0;
  const appShell = Boolean(mount) && mountWords < 20 && wordCount < 80;

  return {
    lang,
    title,
    meta,
    links,
    headings,
    images,
    text,
    wordCount,
    jsonLd,
    microdataTypes,
    rdfaTypes,
    timeElements,
    generator,
    isAstro,
    appShell,
    noscriptSaysEnableJs,
    scriptCount,
    hasViewport,
    controls,
    anchors,
    forms,
  };
}

function collectAnchors(body: HTMLElement): PageModel['anchors'] {
  const out: PageModel['anchors'] = [];
  for (const a of body.querySelectorAll('a[href]')) {
    if (out.length >= 500) break;
    const href = (a.getAttribute('href') ?? '').trim();
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) continue;
    let inNav = false;
    for (let n = a.parentNode as HTMLElement | null; n && n.tagName; n = n.parentNode as HTMLElement | null) {
      if (n.tagName === 'NAV' || n.tagName === 'HEADER') {
        inNav = true;
        break;
      }
    }
    const text = clean(a.getAttribute('aria-label') || a.textContent || a.querySelector('img[alt]')?.getAttribute('alt') || a.getAttribute('title'));
    out.push({ href, text: text.length > 80 ? `${text.slice(0, 79)}…` : text, inNav });
  }
  return out;
}

function scanForms(body: HTMLElement): PageModel['forms'] {
  const forms = body.querySelectorAll('form');
  const tools: string[] = [];
  let partial = 0;
  for (const f of forms) {
    const name = clean(f.getAttribute('toolname'));
    const desc = clean(f.getAttribute('tooldescription'));
    if (name && desc) tools.push(name);
    else if (name || desc) partial++;
  }
  return { total: forms.length, tools, partial };
}

const CONTROL_SELECTOR = 'button, a[href], input, select, textarea';
const NAMED_INPUT_TYPES = new Set(['submit', 'reset']);

function isHiddenEl(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n && n.tagName; n = n.parentNode as HTMLElement | null) {
    if (n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true') return true;
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') ?? '')) return true;
    if (n.tagName === 'TEMPLATE' || n.tagName === 'NOSCRIPT') return true;
  }
  return false;
}

const clean = (s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Accessible name from static HTML, simplified: aria-labelledby, aria-label, label, text, img alt, svg title, title. */
function hasAccessibleName(el: HTMLElement, root: HTMLElement): boolean {
  const labelledby = clean(el.getAttribute('aria-labelledby'));
  if (labelledby && labelledby.split(' ').some((id) => clean(root.querySelector(`[id="${id.replace(/"/g, '')}"]`)?.textContent))) return true;
  if (clean(el.getAttribute('aria-label'))) return true;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (NAMED_INPUT_TYPES.has(type) || ((type === 'button') && clean(el.getAttribute('value')))) return true;
    if (type === 'submit' || type === 'reset') return true;
    if (type === 'image' && clean(el.getAttribute('alt'))) return true;
  }
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    const id = el.getAttribute('id');
    if (id && clean(root.querySelector(`label[for="${id.replace(/"/g, '')}"]`)?.textContent)) return true;
    for (let n = el.parentNode as HTMLElement | null; n && n.tagName; n = n.parentNode as HTMLElement | null) {
      if (n.tagName === 'LABEL' && clean(n.textContent)) return true;
    }
  } else {
    if (clean(el.textContent)) return true;
    if (el.querySelectorAll('img[alt]').some((i) => clean(i.getAttribute('alt')))) return true;
    if (el.querySelectorAll('svg[aria-label]').some((i) => clean(i.getAttribute('aria-label')))) return true;
  }
  return Boolean(clean(el.getAttribute('title')));
}

function describe(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute('id');
  const href = el.getAttribute('href');
  const type = el.getAttribute('type');
  const name = el.getAttribute('name');
  const cls = clean(el.getAttribute('class')).split(' ').filter(Boolean).slice(0, 2).join('.');
  let d = tag;
  if (tag === 'input' && type) d += `[type="${type}"]`;
  if (id) d += `#${id}`;
  else if (cls) d += `.${cls}`;
  if (href) d += ` href="${href.length > 60 ? `${href.slice(0, 59)}…` : href}"`;
  else if (name) d += ` name="${name}"`;
  return `<${d}>`;
}

function scanControls(root: HTMLElement, body: HTMLElement): PageModel['controls'] {
  let total = 0;
  const unnamed: string[] = [];
  for (const el of body.querySelectorAll(CONTROL_SELECTOR)) {
    if (el.tagName === 'INPUT' && (el.getAttribute('type') ?? '').toLowerCase() === 'hidden') continue;
    if (isHiddenEl(el)) continue;
    total++;
    if (!hasAccessibleName(el, root)) unnamed.push(describe(el));
  }
  return { total, unnamed };
}

export function firstMeta(page: PageModel, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = page.meta.get(k)?.find((x) => x.length > 0);
    if (v) return v;
  }
  return undefined;
}
