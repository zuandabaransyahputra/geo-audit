import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import zlib from 'node:zlib';
import type { Readable } from 'node:stream';
import { USER_AGENT } from './constants';
import { assertSafeUrl, BlockedUrlError, isPublicIp } from './ssrf';
import type { Fetched } from './types';

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchError';
  }
}

export interface SafeFetchOptions {
  /** Per request (whole redirect chain), ms. Default 8000. */
  timeoutMs?: number;
  /** Max decoded body size, bytes. Default 2 MB. */
  maxBytes?: number;
  /** Max redirects to follow. Default 5. */
  maxRedirects?: number;
  /** Accepted content types (prefix match). Missing content type is accepted. */
  accept?: string[];
  /** When the body is larger than `maxBytes`, keep the first `maxBytes` instead of failing. */
  truncate?: boolean;
  /** Accept header to send. */
  acceptHeader?: string;
  /** User-Agent to send instead of the default GEO-Audit one (firewall probes). Header only. */
  userAgent?: string;
  /** Test hook: replace DNS resolution. */
  resolver?: (hostname: string) => Promise<{ address: string; family: number }[]>;
  /**
   * Test hooks only, never set in production: a different address policy and extra ports, so tests can
   * run a local server while still exercising the per-hop checks.
   */
  unsafeTestOverrides?: { isAllowedAddress?: (ip: string, hostname: string) => boolean; allowPorts?: string[] };
}

export const HTML_TYPES = ['text/html', 'application/xhtml+xml'];
export const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream'];
export const XML_TYPES = ['application/xml', 'text/xml', 'application/rss+xml', 'application/atom+xml', 'text/plain'];

const defaultResolver = (hostname: string) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true }) as Promise<{ address: string; family: number }[]>;

/**
 * DNS lookup used for the actual socket connection. Every resolved address must be public; otherwise the
 * connection fails. Because Node connects to exactly the address this returns, DNS rebinding between
 * "check" and "connect" is not possible.
 */
export function makeGuardedLookup(resolver = defaultResolver, isAllowed: (ip: string, hostname: string) => boolean = isPublicIp): LookupFunction {
  return ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
    resolver(hostname).then(
      (addrs) => {
        if (!addrs.length) return callback(new FetchError(`Could not resolve ${hostname}.`));
        const bad = addrs.find((a) => !isAllowed(a.address, hostname));
        if (bad) return callback(new BlockedUrlError(`${hostname} resolves to a private or reserved address.`));
        const wanted = options?.family === 4 || options?.family === 6 ? addrs.filter((a) => a.family === options.family) : addrs;
        const list = wanted.length ? wanted : addrs;
        if (options?.all) callback(null, list);
        else callback(null, list[0]!.address, list[0]!.family);
      },
      (err: NodeJS.ErrnoException) => {
        callback(new FetchError(err.code === 'ENOTFOUND' ? `The domain ${hostname} does not exist.` : `DNS lookup failed for ${hostname}.`));
      },
    );
  }) as unknown as LookupFunction;
}

function contentTypeOk(type: string | undefined, accept: string[] | undefined): boolean {
  if (!accept || !type) return true;
  const t = type.split(';')[0]!.trim().toLowerCase();
  return accept.some((a) => t === a || t.startsWith(a));
}

interface HopResult {
  status: number;
  headers: Record<string, string>;
  location?: string;
  body: string;
  truncated: boolean;
}

function flattenHeaders(h: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}

function requestOnce(url: URL, opts: Required<Omit<SafeFetchOptions, 'resolver' | 'accept' | 'unsafeTestOverrides' | 'userAgent'>> & SafeFetchOptions, signal: AbortSignal): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: 'GET',
        lookup: makeGuardedLookup(opts.resolver, opts.unsafeTestOverrides?.isAllowedAddress),
        headers: {
          'user-agent': opts.userAgent ?? USER_AGENT,
          accept: opts.acceptHeader,
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en;q=0.9, *;q=0.5',
        },
        signal,
        agent: false,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = flattenHeaders(res.headers);
        if (status >= 300 && status < 400 && headers.location) {
          res.resume();
          return resolve({ status, headers, location: headers.location, body: '', truncated: false });
        }
        if (!contentTypeOk(headers['content-type'], status < 400 ? opts.accept : undefined)) {
          res.resume();
          return resolve({ status, headers, body: '', truncated: false });
        }
        const declared = Number(headers['content-length']);
        if (!opts.truncate && Number.isFinite(declared) && declared > opts.maxBytes * 4) {
          res.destroy();
          return reject(new FetchError(`Response is too large (${Math.round(declared / 1024)} KB).`));
        }
        let stream: Readable = res;
        const enc = (headers['content-encoding'] ?? '').toLowerCase();
        if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = (truncated: boolean) => {
          if (done) return;
          done = true;
          resolve({ status, headers, body: Buffer.concat(chunks).toString('utf8'), truncated });
        };
        stream.on('data', (chunk: Buffer) => {
          if (done) return;
          size += chunk.length;
          if (size > opts.maxBytes) {
            // Counting decoded bytes also defuses compression bombs.
            const keep = chunk.length - (size - opts.maxBytes);
            if (keep > 0) chunks.push(chunk.subarray(0, keep));
            res.destroy();
            stream.destroy();
            if (opts.truncate) finish(true);
            else {
              done = true;
              reject(new FetchError(`Response is larger than ${Math.round(opts.maxBytes / 1024 / 1024)} MB.`));
            }
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => finish(false));
        stream.on('error', (err) => {
          if (done) return;
          done = true;
          reject(new FetchError(`Could not read the response (${err.message}).`));
        });
      },
    );
    req.on('error', (err) => {
      if (err instanceof BlockedUrlError || err instanceof FetchError) return reject(err);
      if (err.name === 'AbortError') return reject(new FetchError('The request timed out.'));
      const code = (err as NodeJS.ErrnoException).code;
      const msg =
        code === 'ECONNREFUSED'
          ? 'The server refused the connection.'
          : code === 'ECONNRESET'
            ? 'The server closed the connection.'
            : code?.startsWith('ERR_TLS') || code?.includes('CERT')
              ? `TLS error (${code}).`
              : `Request failed (${code ?? err.message}).`;
      reject(new FetchError(msg));
    });
    req.end();
  });
}

/**
 * GET a user-supplied URL safely: SSRF checks on every hop, guarded DNS, redirect limit, timeout,
 * size limit, content-type allow-list. Never executes anything it downloads.
 */
export async function safeFetch(input: string | URL, options: SafeFetchOptions = {}): Promise<Fetched> {
  const opts = {
    timeoutMs: 8000,
    maxBytes: 2 * 1024 * 1024,
    maxRedirects: 5,
    truncate: false,
    acceptHeader: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
    ...options,
  };
  const ports = { allowPorts: opts.unsafeTestOverrides?.allowPorts };
  const start = assertSafeUrl(input, ports);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const redirects: string[] = [];
  let url = start;
  try {
    for (;;) {
      const hop = await requestOnce(url, opts, controller.signal);
      if (hop.location) {
        if (redirects.length >= opts.maxRedirects) throw new FetchError(`Too many redirects (more than ${opts.maxRedirects}).`);
        let next: URL;
        try {
          next = new URL(hop.location, url);
        } catch {
          throw new FetchError('The server sent an invalid redirect.');
        }
        redirects.push(url.href);
        url = assertSafeUrl(next, ports);
        continue;
      }
      return {
        url: start.href,
        finalUrl: url.href,
        status: hop.status,
        headers: hop.headers,
        body: hop.body,
        redirects,
        truncated: hop.truncated,
      };
    }
  } catch (err) {
    if (controller.signal.aborted && !(err instanceof BlockedUrlError)) throw new FetchError(`The request timed out after ${opts.timeoutMs / 1000} s.`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
