/** Shaped like Cloudflare's managed robots.txt with Content Signals (comments shortened). */
export const CLOUDFLARE_MANAGED = `# As a condition of accessing this website, you agree to abide by the following
# content signals:
#
# search:   building a search index and providing search results.
# ai-input: inputting content into one or more AI models.
# ai-train: training or fine-tuning AI models.

# BEGIN Cloudflare Managed content

User-Agent: *
Content-signal: search=yes, ai-train=no, use=reference
Allow: /

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

# END Cloudflare Managed Content

Sitemap: https://acme.dev/sitemap.xml
`;

/** Shaped like nytimes.com: AI search and user agents blocked, classic search engines allowed. */
export const NYT_LIKE = `User-agent: *
Disallow: /search
Allow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: Claude-SearchBot
Disallow: /

User-agent: Claude-User
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Perplexity-User
Disallow: /

User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: CCBot
Disallow: /

Sitemap: https://acme.dev/sitemap.xml
`;
