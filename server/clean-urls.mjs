// Clean page addresses: /shop instead of /shop.html. Old .html links keep working via a 301.
export const PAGES = ['index', 'shop', 'product', 'thanks', 'creators', 'admin'];

/** Returns the clean path for a legacy .html request path, or null when no redirect applies. */
export function cleanRedirect(url) {
  const q = url.indexOf('?');
  const path = q === -1 ? url : url.slice(0, q);
  const query = q === -1 ? '' : url.slice(q);
  const m = /^\/([a-z]+)\.html$/.exec(path);
  if (!m || !PAGES.includes(m[1])) return null;
  return (m[1] === 'index' ? '/' : '/' + m[1]) + query;
}

export function cleanUrls(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const target = cleanRedirect(req.originalUrl);
  if (!target) return next();
  res.redirect(301, target);
}
