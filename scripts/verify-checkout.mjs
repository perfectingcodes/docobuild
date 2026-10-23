import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { stripe } from '../server/stripe.mjs';

const base = process.env.TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const readiness = await (await fetch(`${base}/api/commerce`)).json();
assert.equal(readiness.testMode, true, 'Refusing to test against a live Stripe account');
assert.equal(readiness.enabled, true);
const post = (body, key = randomUUID(), origin = base) => fetch(`${base}/api/create-checkout-session`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': key },
  body: JSON.stringify(body),
});
const cases = [
  ['one-time', [{ sku: 'multi', mode: 'once', qty: 1 }], 3598, 'payment'],
  ['monthly', [{ sku: 'multi', mode: 'sub', qty: 1 }], 3148, 'subscription'],
  ['mixed', [{ sku: 'multi', mode: 'sub', qty: 1 }, { sku: 'sport', mode: 'once', qty: 1 }], 5548, 'subscription'],
  ['duo', [{ sku: 'duo-domore', mode: 'once', qty: 1 }], 5098, 'payment'],
  ['variety-free-shipping', [{ sku: 'stack', mode: 'once', qty: 1 }], 7999, 'payment'],
];
for (const [name, items, total, mode] of cases) {
  const key = randomUUID();
  const response = await post({ items, unit_amount: 1, success_url: 'https://attacker.invalid' }, key);
  assert.equal(response.status, 200, `${name}: ${await response.clone().text()}`);
  const result = await response.json();
  const id = result.url.match(/cs_test_[a-zA-Z0-9]+/)?.[0];
  assert.ok(id, 'Expected a sandbox Stripe Checkout URL');
  const session = await stripe.checkout.sessions.retrieve(id);
  assert.equal(session.livemode, false);
  assert.equal(session.amount_total, total);
  assert.equal(session.mode, mode);
  assert.ok(session.success_url.startsWith(`${base}/thanks.html?`));
  assert.deepEqual(session.shipping_address_collection.allowed_countries, ['US']);
  const duplicate = await post({ items }, key);
  assert.deepEqual(await duplicate.json(), result, 'Retries must reuse one checkout session');
  const changed = await post({ items: [{ sku: 'sleep', mode: 'once', qty: 2 }] }, key);
  assert.equal(changed.status, 409);
  const success = new URL(session.success_url);
  success.searchParams.set('session_id', id);
  const verification = await (await fetch(`${base}/api/checkout-status?${success.searchParams}`)).json();
  assert.equal(verification.paid, false, 'Open checkout must not be reported as paid');
  success.searchParams.set('proof', '0'.repeat(64));
  assert.equal((await fetch(`${base}/api/checkout-status?${success.searchParams}`)).status, 404);
  await stripe.checkout.sessions.expire(id);
  console.log(`PASS ${name}: total $${(total / 100).toFixed(2)}, correct mode, US only, idempotency and confirmation checks`);
}
assert.equal((await post({ items: [{ sku: '__proto__', mode: 'once', qty: 1 }] })).status, 400);
assert.equal((await post({ items: [{ sku: 'multi', mode: 'once', qty: -1 }] })).status, 400);
assert.equal((await post({ items: [] })).status, 400);
assert.equal((await post({ items: cases[0][1] }, randomUUID(), 'https://attacker.invalid')).status, 403);
assert.equal((await fetch(`${base}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
for (const file of ['/server/index.mjs', '/.replit', '/package.json', '/.git/HEAD']) {
  assert.equal((await fetch(base + file)).status, 404, `${file} must not be public`);
}
console.log('PASS invalid carts, forged origin, unsigned webhook and private file protection');
