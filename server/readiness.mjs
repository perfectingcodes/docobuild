import { CATALOG } from './catalog.mjs';

// Test and live prices can share an account ID. Never decide readiness from
// just one live price or from account.charges_enabled alone.
export function catalogReadiness(prices, { production = false } = {}) {
  const expectedLive = production;
  const products = Object.entries(CATALOG).map(([sku, item]) => ({
    sku, name: item.name,
    ...Object.fromEntries(['once', 'sub'].map(mode => [mode,
      prices.some(p => p.sku === sku && p.mode === mode &&
        p.unit_amount === item[mode] && p.livemode === expectedLive)])),
  }));
  const shipping = Object.fromEntries(['once', 'sub'].map(mode => [mode,
    prices.some(p => p.sku === '_shipping' && p.mode === mode &&
      p.unit_amount === 599 && p.livemode === expectedLive)]));
  return {
    ready: products.every(p => p.once && p.sub) && shipping.once && shipping.sub,
    products, shipping,
  };
}

export function portalReady(portal) {
  return !!(portal?.active && portal.login_page?.enabled && portal.login_page?.url &&
    portal.features?.subscription_cancel?.enabled &&
    portal.features.subscription_cancel.mode === 'at_period_end' &&
    portal.features?.payment_method_update?.enabled);
}
