// Next may expose an internal localhost URL behind its proxy. Match the public Host
// and forwarded protocol rather than comparing against that internal hostname.
export function sameRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const url = new URL(request.url);
    const host = request.headers.get('host') || url.host;
    const forwarded = request.headers.get('x-forwarded-proto');
    const protocol = forwarded === 'https' || forwarded === 'http' ? forwarded + ':' : url.protocol;
    const supplied = new URL(origin);
    return supplied.host === host && supplied.protocol === protocol;
  } catch { return false; }
}
