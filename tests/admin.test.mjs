import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SESSION_SECRET = 'test-secret';
const { issueToken, verifyToken, passwordMatches, parseCookies, cookieHeader, ADMIN_COOKIE } = await import('../server/admin-auth.mjs');
const { cleanEvent, buildSeries, liveCarts, sessionToOrder, ordersCsv, summarizeOrders } = await import('../server/analytics-aggregate.mjs');
const { CATALOG } = await import('../server/catalog.mjs');

test('admin tokens round-trip, expire and reject tampering', () => {
  const t = issueToken(1000);
  assert.equal(verifyToken(t, 2000), true);
  assert.equal(verifyToken(t, 1000 + 13 * 3600 * 1000), false);
  assert.equal(verifyToken(t.slice(0, -2) + 'xx', 2000), false);
  assert.equal(verifyToken('nope', 2000), false);
  assert.equal(parseCookies(cookieHeader(t).split(';')[0])[ADMIN_COOKIE], t);
});
test('password check uses the configured secret and is exact', () => {
  assert.equal(passwordMatches('domore'), true);
  assert.equal(passwordMatches('Domore'), false);
  assert.equal(passwordMatches(undefined), false);
});
test('events are allow-listed and sanitized', () => {
  assert.equal(cleanEvent({ type: 'hack', sid: 'abcdefgh' }), null);
  assert.equal(cleanEvent({ type: 'pageview', sid: 'x' }), null);
  const ev = cleanEvent({ type: 'pageview', sid: 'abcdefgh-1234', path: '/shop.html<script>', device: 'mobile', meta: { a: 1 } });
  assert.equal(ev.path, '/shop.htmlscript');
  assert.equal(ev.device, 'mobile');
  assert.deepEqual(ev.meta, { a: 1 });
});
test('series and summaries aggregate correctly', () => {
  const now = Date.UTC(2026, 9, 28, 12);
  const orders = [{ created: Math.floor(now / 1000) - 3600, amount_total: 2999 }, { created: Math.floor(now / 1000) - 86400 * 2, amount_total: 4499 }];
  const s = buildSeries(3, orders, [{ day: '2026-10-28', visitors: 5, pageviews: 9 }], now);
  assert.equal(s.length, 3);
  assert.equal(s[2].revenue, 2999); assert.equal(s[2].visitors, 5); assert.equal(s[0].orders, 1);
  assert.deepEqual(summarizeOrders(orders), { revenue: 7498, orders: 2, aov: 3749 });
});
test('live carts sum open sessions by sku', () => {
  const r = liveCarts([{ sid: 'a', meta: { items: [{ sku: 'multi', mode: 'once', qty: 2 }] } }, { sid: 'b', meta: { items: [] } }, { sid: 'c', meta: { items: [{ sku: 'stack', mode: 'sub', qty: 1 }, { sku: 'bogus', qty: 1 }] } }], CATALOG);
  assert.equal(r.sessions, 2); assert.equal(r.bySku.multi, 2); assert.equal(r.value, 2999 * 2 + 7199);
});
test('checkout sessions map to orders and csv', () => {
  const o = sessionToOrder({ id: 'cs_test_ABCDEFGH12345678', created: 1, livemode: false, mode: 'payment', payment_status: 'paid', amount_total: 3598, currency: 'usd',
    customer_details: { email: 'a@b.co', name: 'Ada' }, shipping_details: { address: { city: 'Providence', state: 'RI', postal_code: '02903', line1: '1 Main St' } },
    line_items: { data: [{ description: 'Multivitamin', quantity: 1, amount_total: 2999 }] } });
  assert.equal(o.reference, '12345678'); assert.equal(o.mode, 'one-time'); assert.equal(o.shipping.state, 'RI');
  const csv = ordersCsv([o]);
  assert.match(csv, /^reference,date/); assert.match(csv, /"35.98"/); assert.match(csv, /1x Multivitamin/);
});
