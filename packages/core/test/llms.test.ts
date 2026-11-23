import { describe, expect, it } from 'vitest';
import { looksLikeHtml, validateLlmsTxt } from '../src/llms';

const GOOD = `# Acme

> Acme builds fast marketing sites.

Two-person studio in Lisbon.

## Docs

- [Quick start](https://acme.dev/start): Install and first page
- [API](https://acme.dev/api)

## Optional

- [Blog](https://acme.dev/blog): News
`;

describe('validateLlmsTxt', () => {
  it('accepts a spec-compliant file', () => {
    const v = validateLlmsTxt(GOOD);
    expect(v.valid).toBe(true);
    expect(v.title).toBe('Acme');
    expect(v.summary).toBe('Acme builds fast marketing sites.');
    expect(v.sections.map((s) => s.title)).toEqual(['Docs', 'Optional']);
    expect(v.linkCount).toBe(3);
    expect(v.sections[0]!.links[0]).toEqual({ title: 'Quick start', url: 'https://acme.dev/start', notes: 'Install and first page' });
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.notes).toEqual([]);
  });

  it('requires the H1 first', () => {
    const v = validateLlmsTxt('Some text\n# Acme\n');
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toMatch(/H1/);
  });

  it('allows leading blank lines and a BOM', () => {
    expect(validateLlmsTxt('﻿\n\n# Acme\n> x\n## A\n- [a](https://a.b)').valid).toBe(true);
  });

  it('warns about a missing summary and missing sections', () => {
    const v = validateLlmsTxt('# Acme\n\nJust text.');
    expect(v.valid).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/summary/);
    expect(v.warnings.join(' ')).toMatch(/Section/);
  });

  it('joins multi-line blockquotes', () => {
    expect(validateLlmsTxt('# A\n> one\n> two\n').summary).toBe('one two');
  });

  it('warns when no section has links, notes when some do not', () => {
    expect(validateLlmsTxt('# A\n> s\n## One\ntext\n## Two\n- plain item').warnings.join(' ')).toMatch(/No section/);
    const v = validateLlmsTxt('# A\n> s\n## One\n- [x](https://x.y)\n## FAQ\n### Q?\nAnswer\n- plain item');
    expect(v.warnings).toEqual([]);
    expect(v.notes.join(' ')).toMatch(/FAQ/);
    expect(v.notes.join(' ')).toMatch(/1 list item/);
  });

  it('flags extra H1s and relative links', () => {
    const v = validateLlmsTxt('# A\n> s\n# B\n## S\n- [x](/x)');
    expect(v.warnings.join(' ')).toMatch(/one H1/);
    expect(v.notes.join(' ')).toMatch(/relative/);
  });

  it('accepts *, + bullets and link titles', () => {
    const v = validateLlmsTxt('# A\n## S\n* [a](https://a.b "Title"): n\n+ [b](https://b.c)');
    expect(v.linkCount).toBe(2);
  });

  it('rejects HTML served as llms.txt', () => {
    const v = validateLlmsTxt('<!DOCTYPE html><html><body>app</body></html>');
    expect(v.valid).toBe(false);
  });
});

describe('looksLikeHtml', () => {
  it('detects common HTML starts', () => {
    expect(looksLikeHtml('  <!doctype html>')).toBe(true);
    expect(looksLikeHtml('<html lang="en">')).toBe(true);
    expect(looksLikeHtml('<div id="root"></div>')).toBe(true);
    expect(looksLikeHtml('# Title')).toBe(false);
    expect(looksLikeHtml('User-agent: *')).toBe(false);
  });
});
