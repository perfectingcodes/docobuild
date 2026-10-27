import { stripe } from '../server/stripe.mjs';
import { catalogReadiness, portalReady } from '../server/readiness.mjs';

// Read-only: no migrations, seed, webhook creation, or checkout sessions.
const account = await stripe.accounts.retrieve();
const products = await stripe.products.list({ active: true, limit: 100 }).autoPagingToArray({ limit: 10000 });
const prices = [];
for (const product of products) {
  const entries = await stripe.prices.list({ product: product.id, active: true, limit: 100 })
    .autoPagingToArray({ limit: 10000 });
  for (const p of entries) {
    if (p.currency !== 'usd' || (p.recurring &&
      (p.recurring.interval !== 'month' || p.recurring.interval_count !== 1))) continue;
    prices.push({ sku: product.metadata?.doco_sku, unit_amount: p.unit_amount,
      mode: p.recurring ? 'sub' : 'once', livemode: p.livemode });
  }
}
const portals = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
const portal = portals.data.find(p => p.metadata?.doco_portal === 'true');
console.log(JSON.stringify({
  account: { id: account.id, name: account.settings?.dashboard?.display_name,
    chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted },
  sandbox: catalogReadiness(prices),
  live: catalogReadiness(prices, { production: true }),
  subscriptionManagementReady: portalReady(portal),
}, null, 2));
