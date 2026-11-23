import type { Insights } from './insights';
import type { ProbeFetch, ProbeResult } from './probe';
import type { ScoreCap } from './score';

export type Status = 'pass' | 'warn' | 'fail' | 'info';

export type CategoryId = 'ai-access' | 'content' | 'structured-data' | 'seo' | 'agent-readiness';

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
  /** Slug of the article that explains this check (`/insights/<slug>`). */
  learnMore?: string;
  /** Passed only because there was nothing to check (no images, no headings ...). Never a strength. */
  vacuous?: boolean;
  /** Caveats on a passing check, kept apart from `details`; shown as "Pass · notes". */
  notes?: string[];
}

export interface CategoryResult {
  id: CategoryId;
  label: string;
  description: string;
  /** Share of the overall score, 0..1. 0 = reported but not scored (Agent readiness). */
  weight: number;
  /** 0..100 */
  score: number;
  /** For unscored categories: how many of the counted checks pass ("2 of 3 passed"). */
  tally?: { passed: number; total: number };
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
  /** 0..100, after the cap. The grade and `--min-score` use this. */
  score: number;
  /** 0..100, the weighted category average before any cap. */
  rawScore: number;
  /** Set when a cap lowered the score (major AI products blocked, or an app shell). */
  cap: ScoreCap | null;
  grade: Grade;
  categories: CategoryResult[];
  page: {
    status: number;
    redirects: string[];
    title?: string;
    isAstro: boolean;
  };
  insights: Insights;
  /**
   * `Content-Signal:` lines from robots.txt (contentsignals.org). Reported, never scored. `global` merges
   * the lines that apply to every crawler (`User-agent: *` groups and lines before any group).
   */
  contentSignals: ContentSignals | null;
  /** Firewall probes, classified. Empty when none ran. Indicative: real crawlers are also verified by IP. */
  probes: ProbeResult[];
  /** Options in effect for this report. */
  options: { trainingOptOut: boolean; trainingOptOutSource: TrainingOptOutSource | null };
  toolVersion: string;
}

/** `request`: asked for (?training=optout, --training-optout); `content-signal`: robots.txt says ai-train=no for *. */
export type TrainingOptOutSource = 'request' | 'content-signal';

export interface AuditRequestOptions {
  /** Training crawlers are blocked on purpose: do not count that against the score. */
  trainingOptOut?: boolean;
}

export interface ContentSignals {
  global: Record<string, string> | null;
  lines: { agents: string[]; signals: Record<string, string>; line: number }[];
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
  /** What the person asked for; see `AuditRequestOptions`. */
  options?: AuditRequestOptions;
  page: Fetched;
  robots: AuxFetch;
  llms: AuxFetch;
  llmsFull: AuxFetch;
  /** The sitemap that was found (from robots.txt or a default location), if any. */
  sitemap: AuxFetch & { source?: 'robots' | 'default' };
  /** Firewall probes: the page fetched again as AI crawlers. Missing or empty when none ran. */
  probes?: ProbeFetch[];
}
