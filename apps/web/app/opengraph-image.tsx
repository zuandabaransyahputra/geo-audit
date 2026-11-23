import { ImageResponse } from 'next/og';

export const alt = 'GEO Audit: can AI assistants find, read and cite your site?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fbfbfd', padding: 72, fontFamily: 'sans-serif', color: '#1f2130' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 600 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 26 }}>G</div>
          GEO Audit
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, display: 'flex' }}>Can AI assistants find, read and cite your site?</div>
          <div style={{ fontSize: 30, color: '#6b6f80', marginTop: 28, display: 'flex' }}>
            Free score and fixes for ChatGPT, Claude, Perplexity and Google AI Overviews.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 24 }}>
          {['AI access', 'AI-readable content', 'Structured data', 'SEO basics'].map((x) => (
            <div key={x} style={{ display: 'flex', padding: '10px 18px', borderRadius: 999, border: '2px solid #e2e3ec', background: 'white' }}>
              {x}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
