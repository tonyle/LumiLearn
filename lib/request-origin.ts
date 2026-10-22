/** Next's standalone server may use its bind address in request.url.
 * The browser-facing Host header retains the LAN address and port. */
export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    const host = request.headers.get('host') || target.host;
    return (source.protocol === 'http:' || source.protocol === 'https:') &&
      source.protocol === target.protocol && source.origin === origin && source.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}
