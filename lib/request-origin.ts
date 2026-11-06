import { timingSafeEqual } from 'node:crypto';

function trustedHttpsProxy(request: Request, host: string): boolean {
  const secret = process.env.INTERNAL_PROXY_SECRET;
  const supplied = request.headers.get('x-internal-proxy-secret');
  if (!secret || secret.length < 32 || !supplied || request.headers.get('x-forwarded-proto') !== 'https') return false;
  const expected = Buffer.from(secret), actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const configured = process.env.IPAD_APP_URL
      ? new URL(process.env.IPAD_APP_URL)
      : new URL(`https://${process.env.INTERNAL_HTTPS_HOST || ''}`);
    return configured.protocol === 'https:' && configured.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}

/** The browser Host survives standalone binding and the authenticated LAN HTTPS proxy. */
export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    const host = request.headers.get('host') || target.host;
    const protocol = trustedHttpsProxy(request, host) ? 'https:' : target.protocol;
    return (source.protocol === 'http:' || source.protocol === 'https:') &&
      source.protocol === protocol && source.origin === origin && source.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}
