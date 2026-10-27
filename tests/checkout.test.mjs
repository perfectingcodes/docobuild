import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCart, cartTotals, shippingForSubtotal, CATALOG } from '../server/catalog.mjs';
import { buildCheckout } from '../server/checkout.mjs';

const prices = Object.entries(CATALOG).flatMap(([sku, p]) =>
  ['once', 'sub'].map(mode => ({ sku, mode, id: `${sku}-${mode}`, unit_amount: p[mode] })))
  .concat(['once', 'sub'].map(mode => ({ sku: '_shipping', mode, id: `shipping-${mode}`, unit_amount: 599 })));
const urls = { successUrl: 'https://example.com/thanks', cancelUrl: 'https://example.com/shop', requestId: 'test' };
test('rejects empty, malformed, inherited SKU, invalid modes, fractional and oversized quantities', () => {
  for (const bad of [null, [], [{ sku: 'constructor', mode: 'once', qty: 1 }],
    [{ sku: 'multi', mode: 'free', qty: 1 }], [{ sku: 'multi', mode: 'once', qty: 0 }],
    [{ sku: 'multi', mode: 'once', qty: 1.5 }], [{ sku: 'multi', mode: 'once', qty: 21 }]]) {
    assert.throws(() => normalizeCart(bad));
  }
});
test('combines duplicate lines and ignores browser pricing', () => {
  assert.deepEqual(normalizeCart([
    { sku: 'multi', mode: 'once', qty: 1, price_id: 'fake', unit_amount: 1 },
    { sku: 'multi', mode: 'once', qty: 2 },
  ]), [{ sku: 'multi', mode: 'once', qty: 3 }]);
});
test('shipping is strictly free only over $45', () => {
  assert.equal(shippingForSubtotal(4499), 599);
  assert.equal(shippingForSubtotal(4500), 599);
  assert.equal(shippingForSubtotal(4501), 0);
  assert.equal(cartTotals([{ sku: 'multi', mode: 'once', qty: 1 }]).firstShipping, 599);
  assert.equal(cartTotals([{ sku: 'duo-domore', mode: 'once', qty: 1 }]).firstShipping, 599);
  assert.equal(cartTotals([{ sku: 'multi', mode: 'once', qty: 2 }]).firstShipping, 0);
});
test('one-time checkout collects US address and uses approved Stripe Price IDs', () => {
  const p = buildCheckout([{ sku: 'multi', mode: 'once', qty: 1 }], prices, urls);
  assert.equal(p.mode, 'payment');
  assert.deepEqual(p.line_items, [{ price: 'multi-once', quantity: 1 }, { price: 'shipping-once', quantity: 1 }]);
  assert.deepEqual(p.shipping_address_collection.allowed_countries, ['US']);
  assert.equal(p.discounts, undefined);
});
test('every formula and bundle has both price modes', () => {
  for (const sku of Object.keys(CATALOG)) for (const mode of ['once', 'sub']) {
    const p = buildCheckout([{ sku, mode, qty: 1 }], prices, urls);
    assert.equal(p.line_items[0].price, `${sku}-${mode}`);
    assert.equal(p.mode, mode === 'sub' ? 'subscription' : 'payment');
  }
});
test('subscriptions include recurring shipping below threshold', () => {
  const p = buildCheckout([{ sku: 'multi', mode: 'sub', qty: 1 }], prices, urls);
  assert.equal(p.mode, 'subscription');
  assert.equal(p.line_items[1].price, 'shipping-sub');
  assert.equal(p.discounts, undefined);
});
test('mixed cart includes free initial shipping but paid monthly shipping when applicable', () => {
  const p = buildCheckout([{ sku: 'multi', mode: 'sub', qty: 1 }, { sku: 'sport', mode: 'once', qty: 1 }], prices, urls);
  assert.equal(p.mode, 'subscription');
  assert.equal(p.line_items.at(-1).price, 'shipping-sub');
  assert.deepEqual(p.discounts, [{ coupon: 'doco-first-shipping-free' }]);
});
test('qualifying subscription shipments have no shipping charge', () => {
  const p = buildCheckout([{ sku: 'stack', mode: 'sub', qty: 1 }], prices, urls);
  assert.equal(p.line_items.length, 1);
  assert.equal(p.discounts, undefined);
});
test('missing price prevents checkout, never falls back to browser amounts', () => {
  assert.throws(() => buildCheckout([{ sku: 'multi', mode: 'once', qty: 1 }], [], urls), /not configured/);
});
