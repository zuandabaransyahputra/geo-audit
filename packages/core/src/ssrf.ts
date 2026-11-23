import ipaddr from 'ipaddr.js';

/** Thrown when a URL or the address it resolves to is not allowed. */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

/** Extra IPv4 ranges we refuse on top of everything ipaddr.js does not call `unicast`. */
const EXTRA_BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['100.64.0.0', 10], // CGNAT
  ['169.254.0.0', 16], // link-local, incl. cloud metadata 169.254.169.254
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['240.0.0.0', 4], // reserved + broadcast
];

const EXTRA_BLOCKED_V6: [string, number][] = [
  ['fc00::', 7], // unique local (incl. fd00:ec2::254, AWS metadata over IPv6)
  ['fe80::', 10], // link-local
  ['fec0::', 10], // deprecated site-local
  ['64:ff9b::', 96], // NAT64, can embed private IPv4
  ['64:ff9b:1::', 48],
  ['2002::', 16], // 6to4, can embed private IPv4
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentation
  ['ff00::', 8], // multicast
];

/** True only for globally routable unicast addresses. Unparseable input is treated as not public. */
export function isPublicIp(address: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(address.replace(/^\[|\]$/g, '').replace(/%.*$/, ''));
  } catch {
    return false;
  }
  if (addr.kind() === 'ipv6') {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) return isPublicIp(v6.toIPv4Address().toString());
    // IPv4-compatible (deprecated) ::a.b.c.d
    const parts = v6.parts;
    if (parts.slice(0, 6).every((p) => p === 0) && (parts[6] !== 0 || parts[7]! > 1)) {
      const hi = parts[6]!;
      const lo = parts[7]!;
      return isPublicIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    if (v6.range() !== 'unicast') return false;
    return !EXTRA_BLOCKED_V6.some(([net, bits]) => v6.match(ipaddr.IPv6.parse(net), bits));
  }
  const v4 = addr as ipaddr.IPv4;
  if (v4.range() !== 'unicast') return false;
  return !EXTRA_BLOCKED_V4.some(([net, bits]) => v4.match(ipaddr.IPv4.parse(net), bits));
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa', '.lan', '.intranet', '.corp'];

/**
 * Validate a URL before any network access: http(s) only, default ports only, no credentials,
 * no obviously internal host names, and IP literals must be public. DNS answers are checked separately
 * at connect time (see `guardedLookup`), which also covers every redirect hop.
 */
export function assertSafeUrl(input: string | URL, opts: { allowPorts?: string[] } = {}): URL {
  let url: URL;
  try {
    url = typeof input === 'string' ? new URL(input) : new URL(input.href);
  } catch {
    throw new BlockedUrlError('That is not a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('Only http and https URLs can be audited.');
  }
  if (url.username || url.password) {
    throw new BlockedUrlError('URLs with credentials are not allowed.');
  }
  if (url.port && url.port !== '80' && url.port !== '443' && !opts.allowPorts?.includes(url.port)) {
    throw new BlockedUrlError('Only the standard ports 80 and 443 are allowed.');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) throw new BlockedUrlError('The URL has no host.');
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new BlockedUrlError('Local and internal host names are not allowed.');
  }
  const literal = host.replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(literal)) {
    if (!isPublicIp(literal)) throw new BlockedUrlError('Private, loopback and reserved addresses are not allowed.');
  } else if (!host.includes('.')) {
    // Single-label names only resolve on internal networks.
    throw new BlockedUrlError('Use a full public domain name (e.g. example.com).');
  }
  return url;
}

/**
 * Turn user input like `example.com/page` into an absolute https URL. Throws BlockedUrlError for
 * anything unsafe.
 */
export function normalizeInputUrl(input: string): URL {
  let s = input.trim();
  if (!s) throw new BlockedUrlError('Enter a URL to audit.');
  if (s.length > 2048) throw new BlockedUrlError('That URL is too long.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[^:]+:\d+/.test(s)) {
      throw new BlockedUrlError('Only http and https URLs can be audited.');
    }
    s = `https://${s.replace(/^\/+/, '')}`;
  }
  const url = assertSafeUrl(s);
  url.hash = '';
  return url;
}
