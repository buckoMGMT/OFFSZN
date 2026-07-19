// Coerces a client-supplied returnUrl onto the calling app's own origin.
// Blocks javascript:/data: URIs and off-origin redirects (open-redirect / XSS).
// The trusted base is the request's Origin/Referer header — set by the browser,
// not controllable from the request body.
export function safeReturnUrl(req, returnUrl) {
  const source = req.headers.get('origin') || req.headers.get('referer');
  if (!source) return null;
  let base;
  try {
    const b = new URL(source);
    if (b.protocol !== 'https:' && b.protocol !== 'http:') return null;
    base = b.origin;
  } catch {
    return null;
  }
  if (!returnUrl || typeof returnUrl !== 'string') return base + '/';
  try {
    const u = new URL(returnUrl, base);
    if ((u.protocol === 'https:' || u.protocol === 'http:') && u.origin === base) return u.toString();
  } catch { /* invalid URL — fall back to origin root */ }
  return base + '/';
}