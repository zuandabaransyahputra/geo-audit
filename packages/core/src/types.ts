export type Status = 'pass' | 'warn' | 'fail' | 'info';

export type CategoryId = 'ai-access' | 'content' | 'structured-data' | 'seo';

export interface Fix {
  /** One or two sentences: what to do. */
  text: string;
  /** Copy-pasteable snippet, already filled in with the site's own values where possible. */
  snippet?: string;
  /** Language hint for the snippet (html, txt, json, md ...). */
  lang?: string;
}

export interface CheckResult {
  id: string;
  category: CategoryId;
  title: string;
  status: Status;
  /** 0..1; how much of this check's weight is earned. */
  score: number;
  /** Relative weight inside its category. 0 = informational. */
  weight: number;
  /** What we found, in one line. */
  summary: string;
  /** Why it matters, in one sentence. */
  why: string;
  /** Extra findings (bot names, invalid blocks ...). */
  details?: string[];
  fix?: Fix;
}

export interface CategoryResult {
  id: CategoryId;
  label: string;
  description: string;
  /** Share of the overall score, 0..1. */
  weight: number;
  /** 0..100 */
  score: number;
  checks: CheckResult[];
}

export interface Report {
  /** URL as requested (normalised). */
  url: string;
  /** URL after redirects. */
  finalUrl: string;
  domain: string;
  fetchedAt: string;
  durationMs: number;
  /** 0..100 */
  score: number;
  grade: Grade;
  categories: CategoryResult[];
  page: {
    status: number;
    redirects: string[];
    title?: string;
    isAstro: boolean;
  };
  toolVersion: string;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** A fetched resource as the checks see it. */
export interface Fetched {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  redirects: string[];
  truncated: boolean;
}

/** Outcome of an auxiliary fetch (robots.txt, llms.txt, sitemap ...). */
export type AuxFetch =
  | { ok: true; res: Fetched }
  | { ok: false; error: string };

export interface AuditInputs {
  page: Fetched;
  robots: AuxFetch;
  llms: AuxFetch;
  llmsFull: AuxFetch;
  /** The sitemap that was found (from robots.txt or a default location), if any. */
  sitemap: AuxFetch & { source?: 'robots' | 'default' };
}
