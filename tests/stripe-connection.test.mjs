import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStripeConnection } from '../server/stripe-connection.mjs';
import { findCatalogProduct } from '../server/catalog-matching.mjs';

test('sandbox and live connections coexist and select only the intended environment', () => {
  const rows = [
    { id: 'live', environment: 'production', disabled: false },
    { id: 'test', environment: 'development', disabled: false },
  ];
  assert.equal(selectStripeConnection(rows, false), 'test');
  assert.equal(selectStripeConnection(rows, true), 'live');
  assert.throws(() => selectStripeConnection(rows.slice(0, 1), false));
  assert.throws(() => selectStripeConnection([...rows, rows[0]], true));
  assert.throws(() => selectStripeConnection([{ ...rows[1], disabled: true }], false));
});
test('reuse merchant-created separate subscription products and existing bundle naming', () => {
  const products = [
    { id: 'once', name: 'The More Duo', metadata: {} },
    { id: 'monthly', name: 'The More Duo Subscription', metadata: {} },
  ];
  assert.equal(findCatalogProduct(products, 'duo-domore', 'once').id, 'once');
  assert.equal(findCatalogProduct(products, 'duo-domore', 'sub').id, 'monthly');
  assert.equal(findCatalogProduct([{ name: 'Sleep DOCO Strips Subscription', id: 'sleep' }], 'sleep', 'sub').id, 'sleep');
});
test('canonical sandbox products can continue holding both price modes', () => {
  const product = { id: 'multi', name: 'Multivitamin DOCO Strips', metadata: { doco_sku: 'multi' } };
  assert.equal(findCatalogProduct([product], 'multi', 'once'), product);
  assert.equal(findCatalogProduct([product], 'multi', 'sub'), product);
});
test('duplicate matching products fail rather than choosing arbitrarily or creating more', () => {
  const product = { name: 'The More Duo', metadata: {} };
  assert.throws(() => findCatalogProduct([product, { ...product }], 'duo-domore', 'once'));
});
