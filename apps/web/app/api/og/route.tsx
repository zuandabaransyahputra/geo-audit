import { ImageResponse } from 'next/og';
import type { Report } from '@geo-audit/core';
import { clientIp, getReport, parseTarget } from '@/lib/run-audit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const COLORS = { pass: '#16a34a', warn: '#d97706', fail: '#dc2626' };
const tone = (s: number) => (s >= 80 ? 'pass' : s >= 55 ? 'warn' : 'fail');

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fbfbfd', padding: 64, fontFamily: 'sans-serif', color: '#1f2130' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, fontWeight: 600 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24 }}>G</div>
        GEO Audit
        <div style={{ marginLeft: 'auto', fontSize: 22, color: '#6b6f80', fontWeight: 400 }}>Is your site ready for AI search?</div>
      </div>
      {children}
    </div>
  );
}

function ScoreCard({ report }: { report: Report }) {
  const t = tone(report.score);
  const r = 110;
  const c = 2 * Math.PI * r;
  return (
    <Frame>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 64, marginTop: 24 }}>
        <div style={{ position: 'relative', width: 270, height: 270, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="270" height="270" viewBox="0 0 270 270" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="135" cy="135" r={r} fill="none" stroke="#e8e9f0" strokeWidth="22" />
            <circle cx="135" cy="135" r={r} fill="none" stroke={COLORS[t]} strokeWidth="22" strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={`${c * (1 - report.score / 100)}`} />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, lineHeight: 1 }}>{report.score}</div>
            <div style={{ display: 'flex', fontSize: 24, color: '#6b6f80', marginTop: 6 }}>{`grade ${report.grade}`}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 22 }}>
          <div style={{ fontSize: report.domain.length > 24 ? 44 : 58, fontWeight: 700, letterSpacing: -1, display: 'flex' }}>{report.domain}</div>
          {report.categories.map((cat) => (
            <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24 }}>
                <span>{cat.label}</span>
                <span style={{ fontWeight: 700, color: COLORS[tone(cat.score)] }}>{cat.score}</span>
              </div>
              <div style={{ display: 'flex', height: 12, borderRadius: 6, background: '#e8e9f0' }}>
                <div style={{ width: `${Math.max(2, cat.score)}%`, height: 12, borderRadius: 6, background: COLORS[tone(cat.score)] }} />
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
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, display: 'flex' }}>{host ? `GEO report for ${host}` : 'Can AI assistants find, read and cite your site?'}</div>
        <div style={{ fontSize: 30, color: '#6b6f80', marginTop: 24, display: 'flex' }}>
          Score and fixes for ChatGPT, Claude, Perplexity and Google AI Overviews. Free and open source.
        </div>
      </div>
    </Frame>
  );
}

export async function GET(req: Request) {
  const input = new URL(req.url).searchParams.get('url') ?? '';
  const target = parseTarget(input);
  let element = <Generic />;
  let ok = false;
  if (target.ok) {
    const outcome = await getReport(target.url.href, clientIp(req.headers));
    if (outcome.ok) {
      element = <ScoreCard report={outcome.report} />;
      ok = true;
    } else element = <Generic host={target.url.hostname} />;
  }
  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    headers: { 'Cache-Control': ok ? 'public, max-age=600, s-maxage=600' : 'public, max-age=60' },
  });
}
