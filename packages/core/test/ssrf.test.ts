import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FetchError, makeGuardedLookup, safeFetch } from '../src/fetch';
import { assertSafeUrl, BlockedUrlError, isPublicIp, normalizeInputUrl } from '../src/ssrf';

describe('isPublicIp', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '169.254.0.1',
    '100.64.0.1', // CGNAT
    '100.127.255.255',
    '0.0.0.0',
    '0.1.2.3',
    '224.0.0.1', // multicast
    '239.255.255.250',
    '255.255.255.255',
    '240.0.0.1',
    '192.0.0.8',
    '192.0.2.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '::1',
    '::',
    'fc00::1',
    'fd00:ec2::254', // AWS metadata over IPv6
    'fe80::1',
    'fe80::1%en0',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:7f00:1',
    '::127.0.0.1',
    '64:ff9b::a00:1', // NAT64 of 10.0.0.1
    '2002:7f00:1::', // 6to4 of 127.0.0.1
    '2001:db8::1',
    '[::1]',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it.each(['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '2a00:1450:4001:80b::200e', '::ffff:8.8.8.8'])(
    'allows %s',
    (ip) => {
      expect(isPublicIp(ip)).toBe(true);
    },
  );
});

describe('assertSafeUrl', () => {
  it.each([
    ['ftp://example.com/', /http and https/],
    ['file:///etc/passwd', /http and https/],
    ['javascript:alert(1)', /http and https/],
    ['http://user:pass@example.com/', /credentials/],
    ['http://user@example.com/', /credentials/],
    ['http://example.com:8080/', /ports/],
    ['https://example.com:22/', /ports/],
    ['http://localhost/', /Local/],
    ['http://LOCALHOST./', /Local/],
    ['http://app.localhost/', /Local/],
    ['http://printer.local/', /Local/],
    ['http://metadata.google.internal/', /Local/],
    ['http://intranet/', /full public domain/],
    ['http://127.0.0.1/', /Private/],
    ['http://127.1/', /Private/],
    ['http://2130706433/', /Private/],
    ['http://0x7f000001/', /Private/],
    ['http://0177.0.0.1/', /Private/],
    ['http://169.254.169.254/latest/meta-data/', /Private/],
    ['http://[::1]/', /Private/],
    ['http://[::ffff:127.0.0.1]/', /Private/],
    ['http://[fd00:ec2::254]/', /Private/],
    ['http://10.0.0.1/', /Private/],
    ['not a url', /valid URL/],
  ])('rejects %s', (url, msg) => {
    expect(() => assertSafeUrl(url)).toThrow(BlockedUrlError);
    expect(() => assertSafeUrl(url)).toThrow(msg);
  });

  it.each(['https://example.com/', 'http://example.com:80/', 'https://example.com:443/a?b=c', 'https://93.184.216.34/', 'https://sub.domain.co.uk/'])('accepts %s', (url) => {
    expect(assertSafeUrl(url).href).toBeTruthy();
  });
});

describe('normalizeInputUrl', () => {
  it('adds https and drops the hash', () => {
    expect(normalizeInputUrl('example.com').href).toBe('https://example.com/');
    expect(normalizeInputUrl('  example.com/a#top ').href).toBe('https://example.com/a');
    expect(normalizeInputUrl('example.com:443/x').href).toBe('https://example.com/x');
    expect(normalizeInputUrl('http://example.com').href).toBe('http://example.com/');
  });

  it('rejects non-web schemes and empty input', () => {
    expect(() => normalizeInputUrl('')).toThrow(BlockedUrlError);
    expect(() => normalizeInputUrl('javascript:alert(1)')).toThrow(/http and https/);
    expect(() => normalizeInputUrl('data:text/html,hi')).toThrow(/http and https/);
    expect(() => normalizeInputUrl('localhost')).toThrow(/Local/);
  });
});

describe('guarded DNS lookup', () => {
  const lookup = (addrs: string[], all = false) =>
    new Promise<unknown>((resolve, reject) => {
      const fn = makeGuardedLookup(async () => addrs.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));
      (fn as unknown as (h: string, o: object, cb: (e: Error | null, a?: unknown) => void) => void)('host.test', { all }, (err, a) =>
        err ? reject(err) : resolve(a),
      );
    });

  it('passes public answers through', async () => {
    await expect(lookup(['93.184.216.34'])).resolves.toBe('93.184.216.34');
    await expect(lookup(['93.184.216.34'], true)).resolves.toEqual([{ address: '93.184.216.34', family: 4 }]);
  });

  it('fails when any answer is private (DNS rebinding, split answers)', async () => {
    await expect(lookup(['127.0.0.1'])).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(lookup(['93.184.216.34', '10.0.0.5'])).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(lookup(['169.254.169.254'])).rejects.toThrow(/private/);
  });
});

describe('safeFetch', () => {
  let server: http.Server;
  let port: string;
  const hits: string[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      hits.push(`${req.headers.host}${req.url}`);
      const u = req.url ?? '/';
      if (u === '/ok') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><title>ok</title></html>');
      } else if (u === '/to-private') {
        res.writeHead(302, { location: `http://evil.test:${port}/secret` });
        res.end();
      } else if (u === '/to-metadata') {
        res.writeHead(301, { location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
      } else if (u === '/to-ftp') {
        res.writeHead(301, { location: 'ftp://public.test/' });
        res.end();
      } else if (u.startsWith('/loop')) {
        const n = Number(u.split('/')[2] ?? 0);
        res.writeHead(302, { location: `/loop/${n + 1}` });
        res.end();
      } else if (u === '/big') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('x'.repeat(5000));
      } else if (u === '/slow') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.write('<html>');
        // never ends
      } else if (u === '/pdf') {
        res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end('%PDF');
      } else if (u === '/ua') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(String(req.headers['user-agent']));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = String((server.address() as AddressInfo).port);
  });

  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  // public.test and evil.test both resolve to the local server; only public.test is "public".
  const opts = () => ({
    resolver: async () => [{ address: '127.0.0.1', family: 4 }],
    unsafeTestOverrides: { isAllowedAddress: (_ip: string, host: string) => host === 'public.test', allowPorts: [port] },
  });
  const url = (path: string) => `http://public.test:${port}${path}`;

  it('fetches a page and identifies itself', async () => {
    const res = await safeFetch(url('/ok'), opts());
    expect(res.status).toBe(200);
    expect(res.body).toContain('<title>ok</title>');
    const ua = await safeFetch(url('/ua'), opts());
    expect(ua.body).toMatch(/^GEO-Audit\/\d+\.\d+\.\d+ \(\+https:\/\//);
    expect(ua.body).not.toMatch(/@/);
  });

  it('blocks a localhost URL without the test overrides', async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/ok`)).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(safeFetch(`http://localhost/ok`)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('blocks a public name that resolves to a private address', async () => {
    await expect(safeFetch('http://public.test/ok', { resolver: async () => [{ address: '10.1.2.3', family: 4 }] })).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('re-checks every redirect hop', async () => {
    await expect(safeFetch(url('/to-private'), opts())).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(safeFetch(url('/to-metadata'), opts())).rejects.toThrow(/Private/);
    await expect(safeFetch(url('/to-ftp'), opts())).rejects.toThrow(/http and https/);
    expect(hits.some((h) => h.startsWith('evil.test'))).toBe(false);
  });

  it('stops after 5 redirects', async () => {
    await expect(safeFetch(url('/loop/0'), opts())).rejects.toThrow(/Too many redirects/);
    const ok = await safeFetch(url('/loop/0'), { ...opts(), maxRedirects: 10 }).catch((e: Error) => e);
    expect(ok).toBeInstanceOf(FetchError); // still loops forever, but got further
  });

  it('enforces the size limit, or truncates when asked', async () => {
    await expect(safeFetch(url('/big'), { ...opts(), maxBytes: 1000 })).rejects.toThrow(/larger than/);
    const t = await safeFetch(url('/big'), { ...opts(), maxBytes: 1000, truncate: true });
    expect(t.truncated).toBe(true);
    expect(t.body).toHaveLength(1000);
  });

  it('times out', async () => {
    await expect(safeFetch(url('/slow'), { ...opts(), timeoutMs: 300 })).rejects.toThrow(/timed out/);
  });

  it('does not read bodies of unexpected content types', async () => {
    const res = await safeFetch(url('/pdf'), { ...opts(), accept: ['text/html'] });
    expect(res.body).toBe('');
    expect(res.headers['content-type']).toBe('application/pdf');
  });
});
