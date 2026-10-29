// Explicit verified storefront origins only; never trust a request's Host header.
export function checkoutOrigin(origin, { production = true, devDomain } = {}) {
  const allowed = new Set(['https://docostrips.com', 'https://www.docostrips.com', 'https://docobuild.replit.app']);
  if (!production) {
    if (devDomain) allowed.add(`https://${devDomain}`);
    allowed.add('http://127.0.0.1:5000');
  }
  return allowed.has(origin) ? origin : null;
}
