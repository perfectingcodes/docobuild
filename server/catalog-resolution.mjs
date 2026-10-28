import { CATALOG } from './catalog.mjs';
import { LIVE_CATALOG } from './live-catalog.mjs';

// Both the synchronized DB query and startup's read-only Stripe audit use this
// selector. The checkout path cannot pick a different duplicate than startup.
export function selectCheckoutPrices(rows, { production = false } = {}) {
  return Object.entries({ ...CATALOG, _shipping: { once: 599, sub: 599 } })
    .flatMap(([sku, item]) => ['once', 'sub'].map(mode => {
      const identity = production ? LIVE_CATALOG[sku][mode] : null;
      const candidates = rows.filter(row =>
        row.sku === sku && row.mode === mode && row.unit_amount === item[mode] &&
        row.livemode === production && (!identity ||
          (row.product_id === identity[0] && row.id === identity[1])));
      if (candidates.length !== 1) {
        throw new Error(`${candidates.length ? 'Ambiguous' : 'Missing or invalid'} approved Stripe price for ${sku}/${mode}; review catalog mapping.`);
      }
      return candidates[0];
    }));
}

export function catalogPriceRows(products, prices, { production = false } = {}) {
  const activeProducts = new Map(products
    .filter(p => p.active && p.livemode === production).map(p => [p.id, p]));
  return prices.flatMap(price => {
    const product = activeProducts.get(price.product);
    const monthly = price.type === 'recurring' && price.recurring?.interval === 'month' &&
      price.recurring.interval_count === 1;
    if (!product || !price.active || price.currency !== 'usd' ||
        price.livemode !== production || (!monthly && price.type !== 'one_time')) return [];
    return [{
      id: price.id, product_id: product.id, sku: product.metadata?.doco_sku,
      mode: monthly ? 'sub' : 'once', unit_amount: price.unit_amount,
      livemode: price.livemode,
    }];
  });
}

// Catalog setup is an explicit merchant operation, never a startup side effect.
// Only GETs go to Stripe here. Syncing selected entities refreshes the local DB
// even when an old product's metadata changed after its creation-time cursor.
export async function synchronizeCheckoutCatalog({ stripe, sync, production = false }) {
  const [products, prices] = await Promise.all([
    stripe.products.list({ active: true, limit: 100 }).autoPagingToArray({ limit: 10000 }),
    stripe.prices.list({ active: true, limit: 100 }).autoPagingToArray({ limit: 10000 }),
  ]);
  const selected = selectCheckoutPrices(catalogPriceRows(products, prices, { production }), { production });
  for (const id of new Set(selected.flatMap(p => [p.product_id, p.id]))) {
    await sync.syncSingleEntity(id);
  }
  return selected;
}
