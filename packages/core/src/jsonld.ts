export type JsonObject = { [key: string]: unknown };

export interface JsonLdNode {
  types: string[];
  data: JsonObject;
}

export interface JsonLdExtraction {
  blocks: number;
  /** Blocks that failed to parse, with the parser message. */
  invalid: { index: number; error: string }[];
  /** Every typed node found, including `@graph` members and nested objects. */
  nodes: JsonLdNode[];
  /** Nodes by `@id`, to resolve references like `"author": { "@id": "#person" }`. */
  ids: Map<string, JsonObject>;
}

/** `schema:Person`, `https://schema.org/Person` -> `Person`. */
export function normalizeType(t: string): string {
  const s = t.trim();
  const slash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('#'));
  const tail = slash >= 0 ? s.slice(slash + 1) : s;
  const colon = tail.lastIndexOf(':');
  return colon >= 0 ? tail.slice(colon + 1) : tail;
}

function typesOf(obj: JsonObject): string[] {
  const t = obj['@type'] ?? obj.type;
  if (typeof t === 'string') return [normalizeType(t)];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string').map(normalizeType);
  return [];
}

function cleanScript(raw: string): string {
  return raw
    .trim()
    .replace(/^<!--/, '')
    .replace(/-->$/, '')
    .replace(/^\/\/\s*<!\[CDATA\[/, '')
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\/\/\s*\]\]>$/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

/** Parse the contents of `<script type="application/ld+json">` blocks. */
export function extractJsonLd(scripts: string[]): JsonLdExtraction {
  const nodes: JsonLdNode[] = [];
  const invalid: JsonLdExtraction['invalid'] = [];
  const seen = new Set<unknown>();
  const ids = new Map<string, JsonObject>();

  const walk = (value: unknown, depth: number) => {
    if (depth > 12 || value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const v of value) walk(v, depth + 1);
      return;
    }
    const obj = value as JsonObject;
    const types = typesOf(obj);
    if (types.length) nodes.push({ types, data: obj });
    const id = obj['@id'];
    if (typeof id === 'string' && Object.keys(obj).some((k) => !k.startsWith('@'))) ids.set(id, obj);
    for (const [k, v] of Object.entries(obj)) {
      if (k === '@context') continue;
      walk(v, depth + 1);
    }
  };

  scripts.forEach((raw, index) => {
    const text = cleanScript(raw);
    if (!text) {
      invalid.push({ index, error: 'Empty block.' });
      return;
    }
    try {
      walk(JSON.parse(text), 0);
    } catch (err) {
      invalid.push({ index, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return { blocks: scripts.length, invalid, nodes, ids };
}

/** Types that tell an assistant who is behind the site or what a page is about. */
export const ENTITY_TYPES = ['Organization', 'Corporation', 'LocalBusiness', 'ProfessionalService', 'Person', 'NewsMediaOrganization', 'EducationalOrganization', 'OnlineStore', 'Store'];
export const CONTENT_TYPES = [
  'WebSite', 'WebPage', 'AboutPage', 'ContactPage', 'ProfilePage', 'CollectionPage', 'ItemPage', 'FAQPage', 'QAPage',
  'Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'HowTo', 'Product', 'Service', 'SoftwareApplication',
  'Course', 'Event', 'Recipe', 'Review', 'BreadcrumbList', 'CreativeWork', 'VideoObject', 'Book', 'JobPosting', 'Offer',
];
export const USEFUL_TYPES = new Set([...ENTITY_TYPES, ...CONTENT_TYPES]);

const ARTICLE = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle'];
const ORG = ['Organization', 'Corporation', 'NewsMediaOrganization', 'EducationalOrganization', 'OnlineStore'];
const LOCAL = ['LocalBusiness', 'ProfessionalService', 'Store', 'Restaurant'];

function has(obj: JsonObject, key: string): boolean {
  const v = obj[key];
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Missing fields per node, against Google's required/recommended properties (simplified). */
export function missingFields(node: JsonLdNode): string[] {
  const d = node.data;
  const t = node.types;
  const missing: string[] = [];
  const need = (...keys: string[]) => {
    for (const k of keys) if (!has(d, k)) missing.push(k);
  };
  // Nodes that are only references (`{"@id": ...}` with a type) are not checked.
  const keys = Object.keys(d).filter((k) => !k.startsWith('@'));
  if (keys.length === 0) return [];

  if (t.some((x) => ARTICLE.includes(x))) {
    need('headline', 'author', 'datePublished');
    if (!has(d, 'image')) missing.push('image');
  } else if (t.includes('Product')) {
    need('name');
    if (!has(d, 'offers') && !has(d, 'review') && !has(d, 'aggregateRating')) missing.push('offers | review | aggregateRating');
  } else if (t.includes('FAQPage')) {
    const main = d.mainEntity;
    const qs = Array.isArray(main) ? main : main ? [main] : [];
    if (!qs.length) missing.push('mainEntity');
    else if (qs.some((q) => !q || typeof q !== 'object' || !has(q as JsonObject, 'name') || !has(q as JsonObject, 'acceptedAnswer'))) {
      missing.push('mainEntity[].name/acceptedAnswer');
    }
  } else if (t.includes('BreadcrumbList')) {
    const items = d.itemListElement;
    if (!Array.isArray(items) || !items.length) missing.push('itemListElement');
    else if (items.some((it) => !it || typeof it !== 'object' || !has(it as JsonObject, 'position') || !has(it as JsonObject, 'name'))) {
      missing.push('itemListElement[].position/name');
    }
  } else if (t.some((x) => LOCAL.includes(x))) {
    need('name', 'address');
  } else if (t.some((x) => ORG.includes(x))) {
    need('name', 'url');
  } else if (t.includes('Person')) {
    need('name');
  } else if (t.includes('WebSite')) {
    need('name', 'url');
  } else if (t.includes('Event')) {
    need('name', 'startDate', 'location');
  } else if (t.includes('Recipe')) {
    need('name', 'image');
  } else if (t.includes('SoftwareApplication')) {
    need('name');
  }
  return missing;
}

/** First string value of a property that may be a string, object with name, or array. */
export function textValue(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = textValue(x);
      if (s) return s;
    }
    return undefined;
  }
  if (v && typeof v === 'object') {
    const o = v as JsonObject;
    return textValue(o.name) ?? textValue(o['@id']);
  }
  return undefined;
}

/** Name of a value that may be a string, a node, an `@id` reference or an array of those. */
export function nameOf(v: unknown, ex: Pick<JsonLdExtraction, 'ids'>): string | undefined {
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = nameOf(x, ex);
      if (s) return s;
    }
    return undefined;
  }
  if (v && typeof v === 'object') {
    const o = v as JsonObject;
    const direct = textValue(o.name);
    if (direct) return direct;
    const ref = typeof o['@id'] === 'string' ? ex.ids.get(o['@id']) : undefined;
    if (ref) return textValue(ref.name);
    return undefined;
  }
  return textValue(v);
}
