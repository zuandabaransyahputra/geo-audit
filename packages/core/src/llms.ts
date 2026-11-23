/**
 * Validator for llms.txt (https://llmstxt.org): an H1 with the site name, an optional blockquote summary,
 * optional free text, then `## Section` headings each followed by a Markdown list of links
 * `- [Title](url): optional notes`.
 */

export interface LlmsLink {
  title: string;
  url: string;
  notes?: string;
}

export interface LlmsSection {
  title: string;
  links: LlmsLink[];
}

export interface LlmsValidation {
  /** Passes the required parts of the spec (an H1 first). */
  valid: boolean;
  title?: string;
  summary?: string;
  sections: LlmsSection[];
  linkCount: number;
  errors: string[];
  /** Problems worth fixing. */
  warnings: string[];
  /** Deviations from the spec that assistants tolerate. */
  notes: string[];
}

/** Did the server answer a .txt request with an HTML page (SPA fallback, soft 404)? */
export function looksLikeHtml(body: string): boolean {
  const head = body.slice(0, 1024).trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || /^<(head|body|meta|script|div)[\s>]/.test(head);
}

const LINK_ITEM = /^[-*+]\s+\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*(?::\s*(.*))?$/;

export function validateLlmsTxt(text: string): LlmsValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const sections: LlmsSection[] = [];
  let title: string | undefined;
  let summary: string | undefined;

  if (looksLikeHtml(text)) {
    return { valid: false, sections, linkCount: 0, errors: ['The file is an HTML page, not Markdown.'], warnings, notes };
  }

  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  let i = 0;
  const skipBlank = () => {
    while (i < lines.length && !lines[i]!.trim()) i++;
  };

  skipBlank();
  const first = lines[i]?.trim() ?? '';
  if (/^#\s+\S/.test(first)) {
    title = first.replace(/^#\s+/, '').trim();
    i++;
  } else {
    errors.push('The first line must be an H1 with the site or project name (`# Name`).');
  }

  skipBlank();
  if (lines[i]?.trim().startsWith('>')) {
    const quote: string[] = [];
    while (i < lines.length && lines[i]!.trim().startsWith('>')) {
      quote.push(lines[i]!.trim().replace(/^>\s?/, ''));
      i++;
    }
    summary = quote.join(' ').trim() || undefined;
  }
  if (!summary) warnings.push('Add a one-line `> summary` blockquote under the H1.');

  let current: LlmsSection | null = null;
  let nonLinkItems = 0;
  let extraH1 = 0;
  for (; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (/^#\s/.test(line)) {
      extraH1++;
      continue;
    }
    if (/^##\s+\S/.test(line)) {
      current = { title: line.replace(/^##\s+/, '').trim(), links: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue; // free-form details between summary and first section
    if (/^[-*+]\s/.test(line)) {
      const m = LINK_ITEM.exec(line);
      if (m) {
        const link: LlmsLink = { title: m[1]!.trim(), url: m[2]!.trim() };
        if (m[3]?.trim()) link.notes = m[3].trim();
        current.links.push(link);
      } else {
        nonLinkItems++;
      }
    }
  }

  if (extraH1) warnings.push('Only one H1 is allowed; use `##` for sections.');
  if (!sections.length) warnings.push('Add `## Section` headings with lists of links to your key pages.');
  const empty = sections.filter((s) => !s.links.length);
  if (sections.length && empty.length === sections.length) {
    warnings.push('No section contains a `- [Title](url)` link list.');
  } else if (empty.length) {
    notes.push(`${empty.length} section(s) have no link list (${empty.map((s) => s.title).join(', ')}); the spec expects H2 sections to be lists of links.`);
  }
  if (nonLinkItems) notes.push(`${nonLinkItems} list item(s) are not in the \`[Title](url): notes\` form.`);
  const linkCount = sections.reduce((n, s) => n + s.links.length, 0);
  const relative = sections.flatMap((s) => s.links).filter((l) => !/^[a-z][a-z0-9+.-]*:/i.test(l.url));
  if (relative.length) notes.push(`${relative.length} link(s) are relative; absolute URLs are safer for assistants.`);

  return { valid: errors.length === 0, title, summary, sections, linkCount, errors, warnings, notes };
}

/**
 * The checks Lighthouse's llms.txt audit (Agentic Browsing category) applies to a 200 response: an H1
 * anywhere, at least one Markdown link, and at least 50 characters. Returns the problems, empty when it
 * passes. Source: lighthouse core/audits/agentic/llms-txt.js.
 */
export function lighthouseLlmsProblems(text: string): string[] {
  const problems: string[] = [];
  if (!/^\s*#\s+.+/m.test(text)) problems.push('no H1 header (`# Name`)');
  if (!/\[.+\]\(.+\)/.test(text)) problems.push('no Markdown links');
  if (text.length < 50) problems.push('shorter than 50 characters');
  return problems;
}
