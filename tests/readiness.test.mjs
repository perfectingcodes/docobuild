import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../server/catalog.mjs';
import { catalogReadiness, portalReady } from '../server/readiness.mjs';

const prices = Object.entries(CATALOG).flatMap(([sku, p]) =>
  ['once', 'sub'].map(mode => ({ sku, mode, unit_amount: p[mode], livemode: false })))
  .concat(['once', 'sub'].map(mode =>
    ({ sku: '_shipping', mode, unit_amount: 599, livemode: false })));
test('all fourteen product options and both shipping prices must match the environment', () => {
  assert.equal(catalogReadiness(prices).ready, true);
  assert.equal(catalogReadiness(prices, { production: true }).ready, false);
  assert.equal(catalogReadiness(prices.map(p => ({ ...p, livemode: true })), { production: true }).ready, true);
  for (let i = 0; i < prices.length; i++) {
    assert.equal(catalogReadiness(prices.filter((_, j) => j !== i)).ready, false);
    assert.equal(catalogReadiness(prices.map((p, j) => j === i ? { ...p, livemode: true } : p)).ready, false);
  }
});
test('incorrect amount or mixed live and sandbox prices cannot enable the storefront', () => {
  assert.equal(catalogReadiness(prices.map((p, i) => i === 0 ? { ...p, unit_amount: 1 } : p)).ready, false);
  assert.equal(catalogReadiness([...prices.slice(1), { ...prices[0], livemode: true }]).ready, false);
});
test('portal must allow customers to manage payment methods and cancel monthly billing', () => {
  const portal = { active: true, login_page: { enabled: true, url: 'https://billing.stripe.com/test' },
    features: { subscription_cancel: { enabled: true, mode: 'at_period_end' },
      payment_method_update: { enabled: true } } };
  assert.equal(portalReady(portal), true);
  assert.equal(portalReady({ ...portal, active: false }), false);
  assert.equal(portalReady({ ...portal, login_page: { enabled: false } }), false);
  assert.equal(portalReady({ ...portal, features: {} }), false);
  assert.equal(portalReady(null), false);
});
