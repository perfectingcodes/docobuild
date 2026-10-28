import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../server/catalog.mjs';
import { LIVE_CATALOG } from '../server/live-catalog.mjs';
import { findCatalogProduct } from '../server/catalog-matching.mjs';
import { catalogPriceRows, selectCheckoutPrices, synchronizeCheckoutCatalog } from '../server/catalog-resolution.mjs';

function fixture(production = true, shared = false) {
  const products = new Map(), prices = [];
  for (const [sku, modes] of Object.entries(LIVE_CATALOG)) {
    for (const [mode, [liveProduct, livePrice]] of Object.entries(modes)) {
      const product = production ? liveProduct : `test_${sku}_${shared ? 'both' : mode}`;
      products.set(product, {
        id: product, name: `${CATALOG[sku]?.name || 'US shipping'}${mode === 'sub' && !shared && sku !== '_shipping' ? ' Subscription' : ''}`,
        metadata: { doco_sku: sku }, active: true, livemode: production,
      });
      prices.push({
        id: production ? livePrice : `test_${sku}_${mode}`, product,
        currency: 'usd', unit_amount: CATALOG[sku]?.[mode] || 599,
        active: true, livemode: production,
        type: mode === 'sub' ? 'recurring' : 'one_time',
        recurring: mode === 'sub' ? { interval: 'month', interval_count: 1 } : null,
      });
    }
  }
  return { products: [...products.values()], prices };
}
function select(data, production = true) {
  return selectCheckoutPrices(catalogPriceRows(data.products, data.prices, { production }), { production });
}

test('live imported duplicates reproduce the old startup error but verified identities remain deterministic', () => {
  const data = fixture();
  // Production now contains imported shared products alongside the original
  // separate one-time/monthly products, including duplicate shipping records.
  for (const [sku, amounts] of Object.entries({ ...CATALOG, _shipping: { once: 599, sub: 599 } })) {
    data.products.push({ id: `copy_${sku}`, name: amounts.name || 'US shipping',
      metadata: { doco_sku: sku }, active: true, livemode: true });
    for (const mode of ['once', 'sub']) {
      data.prices.push({ id: `copy_${sku}_${mode}`, product: `copy_${sku}`,
        currency: 'usd', unit_amount: amounts[mode], active: true, livemode: true,
        type: mode === 'sub' ? 'recurring' : 'one_time',
        recurring: mode === 'sub' ? { interval: 'month', interval_count: 1 } : null });
    }
  }
  assert.throws(() => findCatalogProduct(data.products, 'multi', 'once'), /Multiple Stripe products/);
  const expected = Object.values(LIVE_CATALOG).flatMap(modes => Object.values(modes).map(pair => pair[1]));
  assert.deepEqual(select(data).map(p => p.id), expected);
  data.products.reverse(); data.prices.reverse();
  assert.deepEqual(select(data).map(p => p.id), expected, 'must not depend on Stripe list order');
});

test('live identity survives renamed subscription products without guessing from suffixes', () => {
  const data = fixture();
  data.products.forEach(p => { p.name = 'Merchant renamed this product'; });
  assert.equal(select(data).length, 16);
});

test('missing or changed pinned records cannot silently fall back to a same-price copy', () => {
  for (const change of [
    p => { p.active = false; },
    p => { p.livemode = false; },
    p => { p.currency = 'eur'; },
    p => { p.unit_amount = 1; },
    p => { p.id = 'replacement_price'; },
    p => { p.product = 'replacement_product'; },
    p => { p.type = 'recurring'; p.recurring = { interval: 'year', interval_count: 1 }; },
  ]) {
    const data = fixture();
    change(data.prices[0]);
    assert.throws(() => select(data), /Missing or invalid.*multi\/once/);
  }
  for (const change of [
    p => { p.active = false; },
    p => { p.livemode = false; },
    p => { p.metadata.doco_sku = 'sport'; },
  ]) {
    const data = fixture();
    change(data.products[0]);
    assert.throws(() => select(data), /Missing or invalid/);
  }
  const data = fixture();
  data.prices[1].recurring.interval_count = 2;
  assert.throws(() => select(data), /Missing or invalid.*multi\/sub/);
});

test('sandbox supports both shared products and separate renamed subscription products', () => {
  for (const shared of [true, false]) {
    const data = fixture(false, shared);
    data.products.forEach(p => { p.name = 'Renamed in sandbox'; });
    assert.equal(select(data, false).length, 16);
  }
});

test('unconfigured duplicate sandbox prices fail closed instead of choosing the first', () => {
  const data = fixture(false, true);
  data.prices.push({ ...data.prices[0], id: 'duplicate_price' });
  assert.throws(() => select(data, false), /Ambiguous.*multi\/once/);
  const live = fixture();
  live.prices.push({ ...live.prices[0] });
  assert.throws(() => select(live), /Ambiguous.*multi\/once/);
});

test('startup catalog refresh only reads Stripe and syncs selected existing identities locally', async () => {
  const data = fixture();
  const calls = [], synced = [];
  const api = Object.fromEntries(['products', 'prices'].map(kind => [kind, {
    list: () => { calls.push(`GET ${kind}`); return {
      autoPagingToArray: async () => data[kind],
    }; },
    create: () => { throw new Error('Unexpected Stripe write'); },
    update: () => { throw new Error('Unexpected Stripe write'); },
  }]));
  const selected = await synchronizeCheckoutCatalog({
    stripe: api, sync: { syncSingleEntity: async id => synced.push(id) }, production: true,
  });
  assert.deepEqual(calls.sort(), ['GET prices', 'GET products']);
  assert.equal(selected.length, 16);
  assert.deepEqual(new Set(synced), new Set(selected.flatMap(p => [p.product_id, p.id])));
  assert.equal(synced.length, new Set(synced).size);
  data.prices.shift();
  synced.length = 0;
  await assert.rejects(() => synchronizeCheckoutCatalog({
    stripe: api, sync: { syncSingleEntity: async id => synced.push(id) }, production: true,
  }), /Missing or invalid/);
  assert.equal(synced.length, 0, 'validate the entire mapping before local synchronization');
});
