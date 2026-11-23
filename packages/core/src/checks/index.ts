import { firstMeta, type PageModel } from '../html';
import { ENTITY_TYPES, extractJsonLd, textValue } from '../jsonld';
import { looksLikeHtml } from '../llms';
import { parseRobots, type ParsedRobots } from '../robots';
import type { AuditInputs, CategoryId, CheckResult } from '../types';
import { checkAiSearchBots, checkAiTrainingBots, checkIndexing, checkRobotsTxt } from './ai-access';
import { checkLlmsFull, checkLlmsTxt } from './agent-readiness';
import { checkAuthorship, checkFreshness, checkH1, checkHeadingOrder, checkImgAlt, checkLang, checkServerText } from './content';
import { checkCanonical, checkDescription, checkHttps, checkOpenGraph, checkRedirects, checkSitemap, checkStatus, checkTitle, checkTwitter, checkViewport } from './seo';
import { checkJsonLdFields, checkJsonLdPresent, checkJsonLdTypes, checkOtherStructured } from './structured-data';
import type { CheckContext } from './shared';

export { botVerdicts, directivesFor } from './ai-access';
export { escapeHtml, type CheckContext } from './shared';

export const CHECKS: Record<CategoryId, ((ctx: CheckContext) => CheckResult)[]> = {
  'ai-access': [checkAiSearchBots, checkIndexing, checkLlmsTxt, checkLlmsFull, checkRobotsTxt, checkAiTrainingBots],
  content: [checkServerText, checkH1, checkHeadingOrder, checkImgAlt, checkLang, checkFreshness, checkAuthorship],
  'structured-data': [checkJsonLdPresent, checkJsonLdTypes, checkJsonLdFields, checkOtherStructured],
  seo: [checkStatus, checkHttps, checkTitle, checkDescription, checkSitemap, checkCanonical, checkOpenGraph, checkRedirects, checkTwitter, checkViewport],
};

/** Build the shared context the checks read from. */
export function buildContext(inputs: AuditInputs, page: PageModel): CheckContext {
  const url = new URL(inputs.page.finalUrl);
  let robots: ParsedRobots | null = null;
  let robotsState: CheckContext['robotsState'] = 'missing';
  const r = inputs.robots;
  if (!r.ok) robotsState = 'error';
  else if (r.res.status >= 500) robotsState = 'server-error';
  else if (r.res.status >= 400) robotsState = 'missing';
  else if (r.res.status >= 200 && r.res.status < 300) {
    if (looksLikeHtml(r.res.body)) robotsState = 'html';
    else {
      robotsState = 'ok';
      robots = parseRobots(r.res.body);
    }
  }
  const jsonld = extractJsonLd(page.jsonLd);
  const website = jsonld.nodes.find((n) => n.types.includes('WebSite'));
  const entity = jsonld.nodes.find((n) => n.types.some((t) => ENTITY_TYPES.includes(t)));
  const siteName =
    firstMeta(page, 'og:site_name', 'application-name') ??
    textValue(website?.data.name) ??
    textValue(entity?.data.name) ??
    page.title?.split(/\s[|–—·:-]\s/).map((s) => s.trim()).filter(Boolean).sort((a, b) => a.length - b.length)[0] ??
    url.hostname.replace(/^www\./, '');
  const description = firstMeta(page, 'description', 'og:description');
  return { inputs, page, html: inputs.page.body, url, robots, robotsState, jsonld, siteName, description };
}
