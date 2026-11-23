import { ImageResponse } from 'next/og';
import { ARTICLES } from '@/lib/insights';

export const alt = 'GEO Audit Insights';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = ARTICLES.find((x) => x.slug === slug);
  const title = a?.title ?? 'GEO Audit Insights';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fbfbfd', padding: 72, fontFamily: 'sans-serif', color: '#1f2130' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, fontWeight: 600 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 26 }}>G</div>
          <div style={{ display: 'flex' }}>GEO Audit · Insights</div>
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: title.length > 50 ? 64 : 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.08 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#6b6f80' }}>By Zuanda Baransyah Putra</div>
      </div>
    ),
    size,
  );
}
