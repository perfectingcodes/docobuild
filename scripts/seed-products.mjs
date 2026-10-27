import { stripe, initializeStripe, pool, getStripeSync } from '../server/stripe.mjs';
import { CATALOG } from '../server/catalog.mjs';
import { pathToFileURL } from 'node:url';
import { findCatalogProduct } from '../server/catalog-matching.mjs';

export async function ensureCatalog() {
  // One-time setup script only; never creates products during customer requests.
  const products = await stripe.products.list({ active: true, limit: 100 }).autoPagingToArray({ limit: 10000 });
  for (const [sku, item] of Object.entries(CATALOG)) {
    for (const mode of ['once', 'sub']) {
      let product = findCatalogProduct(products, sku, mode);
      if (!product) {
        product = await stripe.products.create({
          name: item.name, shippable: true, metadata: { doco_sku: sku },
        }, { idempotencyKey: `doco-product-${sku}` });
        products.push(product);
      } else if (product.metadata?.doco_sku !== sku || !product.shippable) {
        product = await stripe.products.update(product.id, {
          metadata: { doco_sku: sku }, shippable: true,
        });
        products[products.findIndex(p => p.id === product.id)] = product;
      }
      // Incremental backfill follows creation time, not metadata updates.
      await getStripeSync().syncSingleEntity(product.id);
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 })
        .autoPagingToArray({ limit: 10000 });
      const found = prices.some(p => p.unit_amount === item[mode] && p.currency === 'usd' &&
        (mode === 'sub' ? p.recurring?.interval === 'month' && p.recurring.interval_count === 1 : !p.recurring));
      if (!found) await stripe.prices.create({
        product: product.id, currency: 'usd', unit_amount: item[mode],
        ...(mode === 'sub' ? { recurring: { interval: 'month' } } : {}),
        metadata: { doco_mode: mode },
      }, { idempotencyKey: `doco-price-${sku}-${mode}-${item[mode]}` });
    }
    console.log(`Ready: ${item.name}, one-time and monthly`);
  }
  let shipping = products.find(p => p.metadata?.doco_sku === '_shipping');
  if (!shipping) shipping = await stripe.products.create({
    name: 'US shipping', metadata: { doco_sku: '_shipping' },
  }, { idempotencyKey: 'doco-shipping-product' });
  const shippingPrices = await stripe.prices.list({ product: shipping.id, active: true, limit: 100 });
  for (const [mode, amount] of [['sub', 599], ['once', 599]]) {
    if (shippingPrices.data.some(p => p.unit_amount === amount && p.currency === 'usd' &&
        (mode === 'sub' ? p.recurring?.interval === 'month' : !p.recurring))) continue;
    await stripe.prices.create({
      product: shipping.id, currency: 'usd', unit_amount: amount,
      ...(mode === 'sub' ? { recurring: { interval: 'month' } } : {}),
    }, { idempotencyKey: `doco-shipping-${mode}-599` });
  }
  // Shipping on mixed carts is based on each shipment: initial shipment may
  // qualify for free shipping while later subscription shipments do not.
  // A one-use discount on the shipping product handles that initial difference.
  try { await stripe.coupons.retrieve('doco-first-shipping-free'); }
  catch (e) {
    if (e.code !== 'resource_missing') throw e;
    await stripe.coupons.create({
      id: 'doco-first-shipping-free', name: 'First shipment shipping included',
      amount_off: 599, currency: 'usd', duration: 'once',
      applies_to: { products: [shipping.id] },
    }, { idempotencyKey: 'doco-first-shipping-free' });
  }
  // Secure guest subscription management via Stripe's email-login portal.
  const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  let portal = configurations.data.find(c => c.metadata?.doco_portal === 'true');
  if (!portal) portal = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Manage your DOCO subscriptions' },
    login_page: { enabled: true },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email'] },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
    },
    metadata: { doco_portal: 'true' },
  }, { idempotencyKey: 'doco-portal-config' });
  else if (portal.features.customer_update.allowed_updates.includes('shipping')) {
    portal = await stripe.billingPortal.configurations.update(portal.id, {
      features: { customer_update: { enabled: true, allowed_updates: ['email'] } },
    });
  }
  console.log(`Subscription management ready: ${!!portal.login_page?.url}`);
  await getStripeSync().syncBackfill({ object: 'product' });
  await getStripeSync().syncBackfill({ object: 'price' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const account = await initializeStripe();
    console.log(`Preparing catalog in connected account ${account.id}`);
    await ensureCatalog();
  } catch (error) {
    console.error('Catalog setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    process.exit(process.exitCode || 0);
  }
}
