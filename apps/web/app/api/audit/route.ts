import { clientIp, getReport } from '@/lib/run-audit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** GET /api/audit?url=example.com -> the full report as JSON. */
export async function GET(req: Request) {
  const input = new URL(req.url).searchParams.get('url') ?? '';
  const outcome = await getReport(input, clientIp(req.headers));
  if (!outcome.ok) {
    const status = outcome.kind === 'rate-limit' ? 429 : outcome.kind === 'error' ? 500 : outcome.kind === 'fetch' ? 502 : 400;
    return Response.json(
      { error: outcome.kind, message: outcome.message },
      { status, headers: outcome.retryAfter ? { 'Retry-After': String(outcome.retryAfter) } : {} },
    );
  }
  return Response.json(outcome.report, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
