export type BotPurpose = 'search' | 'user' | 'training';

export interface Bot {
  token: string;
  owner: string;
  purpose: BotPurpose;
  /** What it powers, in a few words. */
  role: string;
}

/**
 * Crawlers that decide whether AI assistants can find and cite a page. `search` and `user` agents fetch
 * pages to answer questions and link to them; `training` agents collect data for models. Googlebot and
 * Bingbot are included because Google AI Overviews use the normal Google index and ChatGPT search leans
 * on Bing's.
 */
export const AI_BOTS: Bot[] = [
  { token: 'Googlebot', owner: 'Google', purpose: 'search', role: 'Google Search and AI Overviews' },
  { token: 'Bingbot', owner: 'Microsoft', purpose: 'search', role: 'Bing, Copilot and the index behind ChatGPT search' },
  { token: 'OAI-SearchBot', owner: 'OpenAI', purpose: 'search', role: 'ChatGPT search results' },
  { token: 'ChatGPT-User', owner: 'OpenAI', purpose: 'user', role: 'pages ChatGPT opens for a user' },
  { token: 'Claude-SearchBot', owner: 'Anthropic', purpose: 'search', role: 'Claude search results' },
  { token: 'Claude-User', owner: 'Anthropic', purpose: 'user', role: 'pages Claude opens for a user' },
  { token: 'PerplexityBot', owner: 'Perplexity', purpose: 'search', role: 'Perplexity answers and citations' },
  { token: 'Perplexity-User', owner: 'Perplexity', purpose: 'user', role: 'pages Perplexity opens for a user' },
  { token: 'GPTBot', owner: 'OpenAI', purpose: 'training', role: 'OpenAI model training' },
  { token: 'ClaudeBot', owner: 'Anthropic', purpose: 'training', role: 'Anthropic model training' },
  { token: 'Google-Extended', owner: 'Google', purpose: 'training', role: 'Gemini training and grounding' },
  { token: 'Applebot-Extended', owner: 'Apple', purpose: 'training', role: 'Apple Intelligence training' },
  { token: 'CCBot', owner: 'Common Crawl', purpose: 'training', role: 'Common Crawl, used by many models' },
  { token: 'Bytespider', owner: 'ByteDance', purpose: 'training', role: 'ByteDance model training' },
  { token: 'meta-externalagent', owner: 'Meta', purpose: 'training', role: 'Meta AI training' },
];
