import { ImageResponse } from 'next/og';
import { parseTarget } from '@/lib/run-audit';
import { readCard, type CardData } from '@/lib/og-card';

export const runtime = 'nodejs';

// No audit runs here (see lib/og-card.ts): a signed card renders from its query, anything else gets
// the generic card. Both are pure functions of the URL, so they can be cached for a long time.

const COLORS = { pass: '#16a34a', warn: '#d97706', fail: '#dc2626' };
const TINTS = { pass: '#dcfce7', warn: '#fef3c7', fail: '#fee2e2' };
const tone = (s: number) => (s >= 80 ? 'pass' : s >= 55 ? 'warn' : 'fail');
const LABELS = ['AI access', 'AI-readable content', 'Structured data', 'SEO basics'];
const VERDICT = { pass: 'Ready for AI search', warn: 'Partly ready for AI search', fail: 'Not ready for AI search' };

function Logo() {
  return (
    <div style={{ width: 44, height: 44, borderRadius: 11, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5L20 20" />
        <path d="M10.5 7.5v6M7.5 10.5h6" />
      </svg>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fbfbfd', padding: '56px 64px', fontFamily: 'sans-serif', color: '#1f2130' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, fontWeight: 700 }}>
        <Logo />
        GEO Audit
        <div style={{ marginLeft: 'auto', fontSize: 22, color: '#6b6f80', fontWeight: 400 }}>Is your site ready for AI search?</div>
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#6b6f80', borderTop: '1px solid #e5e7ef', paddingTop: 18 }}>
        <span>ChatGPT · Claude · Perplexity · Google AI Overviews</span>
        <span>geoaudit-tool.vercel.app</span>
      </div>
    </div>
  );
}

function ScoreCard({ card }: { card: CardData }) {
  const t = tone(card.score);
  const r = 104;
  const c = 2 * Math.PI * r;
  const domainSize = card.domain.length > 28 ? 40 : card.domain.length > 20 ? 50 : 60;
  return (
    <Frame>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 60 }}>
        <div style={{ position: 'relative', width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="256" height="256" viewBox="0 0 256 256" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="128" cy="128" r={r} fill="none" stroke="#e8e9f0" strokeWidth="22" />
            <circle cx="128" cy="128" r={r} fill="none" stroke={COLORS[t]} strokeWidth="22" strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={`${c * (1 - card.score / 100)}`} />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, lineHeight: 1 }}>{card.score}</div>
            <div style={{ display: 'flex', fontSize: 22, color: '#6b6f80', marginTop: 4 }}>out of 100</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', padding: '6px 16px', borderRadius: 999, background: TINTS[t], color: COLORS[t], fontSize: 24, fontWeight: 700 }}>{`Grade ${card.grade}`}</div>
            <div style={{ display: 'flex', fontSize: 24, color: '#4b4f60' }}>{VERDICT[t]}</div>
          </div>
          <div style={{ fontSize: domainSize, fontWeight: 800, letterSpacing: -1.5, display: 'flex', marginBottom: card.optOut ? 0 : 6 }}>{card.domain}</div>
          {card.optOut && <div style={{ display: 'flex', fontSize: 20, color: '#6b6f80', marginBottom: 6 }}>Training crawlers opted out on purpose</div>}
          {card.categories.map((score, i) => (
            <div key={LABELS.at(i)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22 }}>
                <span>{LABELS.at(i)}</span>
                <span style={{ fontWeight: 700, color: COLORS[tone(score)] }}>{score}</span>
              </div>
              <div style={{ display: 'flex', height: 10, borderRadius: 5, background: '#e8e9f0' }}>
                <div style={{ width: `${Math.max(2, score)}%`, height: 10, borderRadius: 5, background: COLORS[tone(score)] }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function Generic({ host }: { host?: string }) {
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, display: 'flex' }}>{host ? `GEO report for ${host}` : 'Can AI assistants find, read and cite your site?'}</div>
        <div style={{ fontSize: 30, color: '#6b6f80', marginTop: 24, display: 'flex' }}>Free score and concrete fixes for AI search. Open source.</div>
      </div>
    </Frame>
  );
}

export function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const card = readCard(params);
  const legacy = parseTarget(params.get('url'));
  const host = params.get('d') ?? (legacy.ok ? legacy.url.hostname.replace(/^www\./, '') : undefined);
  return new ImageResponse(card ? <ScoreCard card={card} /> : <Generic host={host} />, {
    width: 1200,
    height: 630,
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' },
  });
}
