// U23-REALIP — resolve the visitor's REAL public IP from a proxied request.
//
// Topology (verified live via header capture on /api/health/boot):
//   browser → Aliyun-FC platform edge (knows the real client IP) → Caddy
//   gateway → Next dev server. The gateway rewrites the standard
//   `x-forwarded-for` / `x-real-ip` to its own hop (21.0.0.1), which is what
//   الزيارات/السجل/العملاء used to record — hop IPs instead of people.
//   The platform edge forwards the true client address in the lowercase
//   `remoteip` header (captured 154.182.34.20 — the owner's Egyptian IP —
//   while x-forwarded-for showed 21.0.0.1 on the very same request).
//
// Strategy: the first PUBLIC address wins. Scan x-forwarded-for leftmost
// first (standard multi-proxy semantics), then the edge headers. Private,
// loopback, link-local, CGNAT and the sandbox's own 21.0.0.x hop never count
// as "public" — if nothing public exists we fall back to the leftmost xff
// entry (diagnostic value) and finally 'unknown'.

const EDGE_IP_HEADERS = [
  'remoteip', // platform edge (Aliyun FC) — carries the real client IP
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'x-client-ip',
] as const;

/** True when the string is a globally-routable IP (v4 or v6). */
export function isPublicIp(raw: string | null | undefined): boolean {
  if (!raw) return false;
  let s = raw.trim().toLowerCase();
  if (!s || s === 'unknown') return false;
  if (s.startsWith('::ffff:')) s = s.slice(7); // IPv4-mapped IPv6
  if (s === '::' || s === '::1') return false; // loopback
  if (s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80')) return false; // ULA / link-local
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b, c, d] = m.slice(1).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return false;
    if (a === 0 || a === 10 || a === 127) return false; // this-network / private / loopback
    if (a === 169 && b === 254) return false; // link-local
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 21 && b === 0 && c === 0) return false; // 21.0.0.x — sandbox gateway hop
    if (a >= 224) return false; // multicast / reserved
    return true;
  }
  // other IPv6: accept global-unicast-looking (2000::/3 …), reject the rest
  return /^[23][0-9a-f]{3}:/.test(s);
}

/** Header-derived values must never reach the DB/logs verbatim — stored IPs
 * are bounded to IP-shaped tokens (digits/hex/colons/dots, ≤45 chars), which
 * keeps the gateway-hop diagnostic while dropping arbitrary attacker strings
 * (log-injection guard). */
const IP_TOKEN = /^[0-9a-fA-F:.]{1,45}$/;

/** Best-effort real client IP from request headers. Never throws. */
export function clientIpFromHeaders(headers: Headers): string {
  try {
    const pick = (raw: string | undefined | null): string => {
      const m = raw ? raw.match(IP_TOKEN) : null;
      return m ? m[0] : 'unknown';
    };
    const entries = (headers.get('x-forwarded-for') || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    for (const entry of entries) {
      if (isPublicIp(entry)) return pick(entry);
    }
    for (const name of EDGE_IP_HEADERS) {
      const value = headers.get(name) || '';
      const first = value.split(',')[0]?.trim();
      if (first && isPublicIp(first)) return pick(first);
    }
    return pick(entries[0]);
  } catch {
    return 'unknown';
  }
}
