export type BotPurpose = 'search' | 'user' | 'training';

export interface Bot {
  /** robots.txt product token, as the vendor documents it. */
  token: string;
  owner: string;
  /** search = builds an index that answers cite; user = fetches a page when a person asks; training = model data. */
  purpose: BotPurpose;
  /** The product in `PRODUCTS` (products.ts) this crawler feeds. */
  productId: string;
  /** What it powers, in a few words. */
  role: string;
  /** Vendor page that documents the token and its robots.txt behaviour. Empty when the vendor publishes none. */
  docsUrl: string;
  /** What the vendor says about robots.txt: `may-ignore` when it says rules may not apply. */
  robotsTxt: 'respects' | 'may-ignore';
  /** Date the token and behaviour were last checked against `docsUrl` (YYYY-MM-DD). */
  verifiedAt: string;
  /** False for crawlers we show but never score (they do not follow robots.txt at all). Default true. */
  scored?: boolean;
  /** The vendor's documented User-Agent string; firewall probes send it with a GEO-Audit-probe marker. */
  userAgent?: string;
}

const OPENAI = 'https://developers.openai.com/api/docs/bots';
const ANTHROPIC = 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler';
const PERPLEXITY = 'https://docs.perplexity.ai/guides/bots';
const GOOGLE_CRAWLERS = 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers';
const APPLE = 'https://support.apple.com/en-us/119829';
const GOOGLE_USER_FETCHERS = 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers';
const DUCKDUCKGO = 'https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot';
const AMAZON = 'https://developer.amazon.com/amazonbot';
const MISTRAL = 'https://docs.mistral.ai/robots';
const META = 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/';

/**
 * Crawlers that decide whether AI assistants can find and cite a page. Googlebot, Bingbot and Applebot are
 * included because Google AI Overviews, Microsoft Copilot and Apple's Siri answers are built on those search
 * crawlers. Every entry was checked against the vendor's own documentation on `verifiedAt`.
 */
export const AI_BOTS: Bot[] = [
  { token: 'Googlebot', owner: 'Google', purpose: 'search', productId: 'google', role: 'Google Search and AI Overviews', docsUrl: GOOGLE_CRAWLERS, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'Bingbot', owner: 'Microsoft', purpose: 'search', productId: 'copilot', role: 'Bing search and Microsoft Copilot', docsUrl: 'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0', robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'Applebot', owner: 'Apple', purpose: 'search', productId: 'apple', role: 'Siri, Spotlight and Safari suggestions', docsUrl: APPLE, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  {
    token: 'OAI-SearchBot',
    owner: 'OpenAI',
    purpose: 'search',
    productId: 'chatgpt-search',
    role: 'ChatGPT search results',
    docsUrl: OPENAI,
    robotsTxt: 'respects',
    verifiedAt: '2026-11-23',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot',
  },
  // OpenAI: "Because these actions are initiated by a user, robots.txt rules may not apply."
  { token: 'ChatGPT-User', owner: 'OpenAI', purpose: 'user', productId: 'chatgpt-search', role: 'pages ChatGPT opens for a user', docsUrl: OPENAI, robotsTxt: 'may-ignore', verifiedAt: '2026-11-23' },
  { token: 'Claude-SearchBot', owner: 'Anthropic', purpose: 'search', productId: 'claude', role: 'Claude search results', docsUrl: ANTHROPIC, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'Claude-User', owner: 'Anthropic', purpose: 'user', productId: 'claude', role: 'pages Claude opens for a user', docsUrl: ANTHROPIC, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  {
    token: 'PerplexityBot',
    owner: 'Perplexity',
    purpose: 'search',
    productId: 'perplexity',
    role: 'Perplexity answers and citations',
    docsUrl: PERPLEXITY,
    robotsTxt: 'respects',
    verifiedAt: '2026-11-23',
    userAgent: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  },
  // Perplexity: "Since a user requested the fetch, this fetcher generally ignores robots.txt rules."
  { token: 'Perplexity-User', owner: 'Perplexity', purpose: 'user', productId: 'perplexity', role: 'pages Perplexity opens for a user', docsUrl: PERPLEXITY, robotsTxt: 'may-ignore', verifiedAt: '2026-11-23' },
  { token: 'DuckAssistBot', owner: 'DuckDuckGo', purpose: 'search', productId: 'duckduckgo', role: 'AI-assisted answers in DuckDuckGo Search', docsUrl: DUCKDUCKGO, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  // Amazon: "Automated crawling from these listed user agents respects the Robots Exclusion Protocol."
  { token: 'Amzn-SearchBot', owner: 'Amazon', purpose: 'search', productId: 'amazon', role: 'search in Amazon products such as Alexa', docsUrl: AMAZON, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'MistralAI-Index', owner: 'Mistral', purpose: 'search', productId: 'mistral', role: 'Mistral search index behind Vibe answers', docsUrl: MISTRAL, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'MistralAI-User', owner: 'Mistral', purpose: 'user', productId: 'mistral', role: 'pages Vibe opens for a user', docsUrl: MISTRAL, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'meta-webindexer', owner: 'Meta', purpose: 'search', productId: 'meta-ai', role: 'Meta AI search results and citations', docsUrl: META, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  // Meta: it "may bypass robots.txt rules" because the fetches are requested by users.
  { token: 'meta-externalfetcher', owner: 'Meta', purpose: 'user', productId: 'meta-ai', role: 'links Meta AI fetches for a user', docsUrl: META, robotsTxt: 'may-ignore', verifiedAt: '2026-11-23' },
  // Google: user-triggered fetchers "generally ignore robots.txt rules". Shown, never scored.
  { token: 'Google-Agent', owner: 'Google', purpose: 'user', productId: 'google', role: 'agents on Google infrastructure acting for a user', docsUrl: GOOGLE_USER_FETCHERS, robotsTxt: 'may-ignore', verifiedAt: '2026-11-23', scored: false },
  {
    token: 'GPTBot',
    owner: 'OpenAI',
    purpose: 'training',
    productId: 'chatgpt-training',
    role: 'OpenAI model training',
    docsUrl: OPENAI,
    robotsTxt: 'respects',
    verifiedAt: '2026-11-23',
    userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot',
  },
  { token: 'ClaudeBot', owner: 'Anthropic', purpose: 'training', productId: 'claude', role: 'Anthropic model training', docsUrl: ANTHROPIC, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'Google-Extended', owner: 'Google', purpose: 'training', productId: 'google', role: 'Gemini training and grounding', docsUrl: GOOGLE_CRAWLERS, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'Applebot-Extended', owner: 'Apple', purpose: 'training', productId: 'apple', role: 'Apple Intelligence training', docsUrl: APPLE, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  // Amazon: used "to improve our products and services", which may include training Amazon AI models.
  { token: 'Amazonbot', owner: 'Amazon', purpose: 'training', productId: 'amazon', role: 'Amazon services and model training', docsUrl: AMAZON, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'meta-externalagent', owner: 'Meta', purpose: 'training', productId: 'meta-ai', role: 'Meta AI training and indexing', docsUrl: META, robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  { token: 'CCBot', owner: 'Common Crawl', purpose: 'training', productId: 'others', role: 'Common Crawl, used by many models', docsUrl: 'https://commoncrawl.org/ccbot', robotsTxt: 'respects', verifiedAt: '2026-11-23' },
  // ByteDance publishes no crawler documentation we could verify; kept because sites commonly block it.
  { token: 'Bytespider', owner: 'ByteDance', purpose: 'training', productId: 'others', role: 'ByteDance model training', docsUrl: '', robotsTxt: 'respects', verifiedAt: '2026-11-23' },
];

/** Crawlers that count in robots.txt scoring. */
export const SCORED_BOTS = (): Bot[] => AI_BOTS.filter((b) => b.scored !== false);

export function botByToken(token: string): Bot | undefined {
  return AI_BOTS.find((b) => b.token === token);
}
