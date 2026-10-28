import { createHmac, timingSafeEqual } from 'node:crypto';
// Admin sessions are signed cookies; no admin table or server-side session store is needed.
const TTL_MS = 12 * 60 * 60 * 1000;
export const ADMIN_COOKIE = 'doco_admin';
export function adminPassword() {
  // Set ADMIN_PASSWORD in Replit Secrets. The fallback is the launch password requested by the owner.
  return process.env.ADMIN_PASSWORD || 'domore';
}
export function passwordMatches(supplied) {
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(supplied), b = Buffer.from(adminPassword());
  return a.length === b.length && timingSafeEqual(a, b);
}
function secret() {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');
  return process.env.SESSION_SECRET;
}
function sign(payload) { return createHmac('sha256', secret()).update(payload).digest('base64url'); }
export function issueToken(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: now + TTL_MS, v: 1 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifyToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 400) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return Number.isFinite(data.exp) && data.exp > now; }
  catch { return false; }
}
export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
export function cookieHeader(token, { secure, maxAgeSeconds = TTL_MS / 1000 } = {}) {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeSeconds)}${secure ? '; Secure' : ''}`;
}
