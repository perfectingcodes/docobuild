import assert from 'node:assert/strict';
import { once } from 'node:events';
import { stripe, account, pool, initializeStripe } from '../server/stripe.mjs';
import { app } from '../server/app.mjs';
import { listCheckoutPrices } from '../server/storage.mjs';
import { CATALOG, cartTotals } from '../server/catalog.mjs';
import { buildCheckout } from '../server/checkout.mjs';
import { catalogReadiness } from '../server/readiness.mjs';

// Live Stripe access is read-only here: no checkout, invoice, payment, customer,
// or subscription is created. Only the local synchronized catalog is refreshed.
assert.equal(process.env.NODE_ENV, 'production', 'Run with NODE_ENV=production to select the live connection');
let server;
try {
  await initializeStripe();
  assert.equal(account.id, 'acct_1UQY8SG2IwfaSIOP');
  assert.equal(account.charges_enabled, true);
  const prices = await listCheckoutPrices();
  assert.equal(catalogReadiness(prices, { production: true }).ready, true);
  assert.ok(prices.every(p => p.livemode === true));
  for (const [sku, item] of Object.entries(CATALOG)) {
    for (const mode of ['once', 'sub']) {
      const cart = [{ sku, mode, qty: 1 }];
      const params = buildCheckout(cart, prices, {
        successUrl: 'https://docobuild.replit.app/thanks.html',
        cancelUrl: 'https://docobuild.replit.app/shop.html',
        requestId: 'read-only-live-readiness',
      });
      const selected = prices.find(p => p.id === params.line_items[0].price);
      assert.equal(selected.sku, sku);
      assert.equal(selected.unit_amount, item[mode]);
      assert.equal(selected.mode, mode);
      assert.equal(params.mode, mode === 'sub' ? 'subscription' : 'payment');
      assert.deepEqual(params.shipping_address_collection.allowed_countries, ['US']);
      const totals = cartTotals(cart);
      const sum = params.line_items.reduce((sum, l) =>
        sum + prices.find(p => p.id === l.price).unit_amount * l.quantity, 0);
      assert.equal(sum, totals.first + totals.firstShipping);
    }
    console.log(`PASS live mapping: ${item.name}, one-time and monthly`);
  }
  const shipping = prices.find(p => p.sku === '_shipping' && p.mode === 'sub');
  const shippingPrice = await stripe.prices.retrieve(shipping.id);
  const coupon = await stripe.coupons.retrieve('doco-first-shipping-free', { expand: ['applies_to'] });
  assert.equal(coupon.livemode, true);
  assert.equal(coupon.valid, true);
  assert.equal(coupon.duration, 'once');
  assert.equal(coupon.amount_off, 599);
  assert.equal(coupon.currency, 'usd');
  assert.deepEqual(coupon.applies_to.products, [shippingPrice.product]);
  const mixed = buildCheckout([
    { sku: 'multi', mode: 'sub', qty: 1 }, { sku: 'sport', mode: 'once', qty: 1 },
  ], prices, { successUrl: 'https://docobuild.replit.app/thanks.html',
    cancelUrl: 'https://docobuild.replit.app/shop.html', requestId: 'read-only-mixed' });
  assert.deepEqual(mixed.discounts, [{ coupon: coupon.id }]);
  console.log('PASS live shipping prices and first-shipment-only shipping discount');

  // Test the production code against the real live account without publishing
  // or exposing a temporary server publicly.
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/commerce`);
  assert.equal(response.status, 200);
  const readiness = await response.json();
  assert.equal(readiness.enabled, true);
  assert.equal(readiness.testMode, false);
  assert.ok(readiness.portalUrl.startsWith('https://billing.stripe.com/p/login/'));
  assert.ok(!readiness.portalUrl.includes('/test_'));
  console.log('PASS production commerce code: enabled=true, testMode=false, live subscription portal');
  console.log('No live checkout session, charge, customer or subscription was created.');
  console.log('Published deployment and real signed webhook delivery still require republishing and external verification.');
} catch (error) {
  console.error('Live readiness failed:', error.message);
  process.exitCode = 1;
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  await pool.end();
  // Stripe sync owns another pool; the standalone check must not remain open.
  process.exit(process.exitCode || 0);
}
