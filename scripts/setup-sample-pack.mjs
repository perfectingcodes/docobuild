// Explicit merchant-requested catalog addition. Never called during startup.
import { stripe, pool } from '../server/stripe.mjs';

try {
  const production = process.env.NODE_ENV === 'production';
  const account = await stripe.accounts.retrieve();
  if (production && (account.id !== 'acct_1UQY8SG2IwfaSIOP' || !account.charges_enabled)) {
    throw new Error('Expected the approved live DOCO account with payments enabled.');
  }
  const products = await stripe.products.list({ active: true, limit: 100 }).autoPagingToArray({ limit: 10000 });
  if (products.some(p => p.livemode !== production)) throw new Error('Wrong Stripe environment.');
  const matches = products.filter(p => p.metadata?.doco_sku === 'sample' || p.name === 'Sample Pack');
  if (matches.length > 1) throw new Error('Ambiguous Sample Pack products; review before setup.');
  let product = matches[0];
  if (product && product.metadata?.doco_sku !== 'sample') throw new Error('Existing Sample Pack lacks approved metadata.');
  if (!product) product = await stripe.products.create({
    name: 'Sample Pack', description: '4 DOCO strips — sample-size pack. One-time purchase.',
    shippable: true, metadata: { doco_sku: 'sample', strips: '4' },
  }, { idempotencyKey: 'doco-sample-pack-product' });
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 }).autoPagingToArray({ limit: 10000 });
  const matching = prices.filter(p => p.type === 'one_time' && p.currency === 'usd' && p.unit_amount === 999 && p.livemode === production);
  if (matching.length > 1) throw new Error('Ambiguous Sample Pack prices.');
  const price = matching[0] || await stripe.prices.create({
    product: product.id, currency: 'usd', unit_amount: 999,
    metadata: { doco_sku: 'sample', doco_mode: 'once' },
  }, { idempotencyKey: 'doco-sample-pack-once-usd-999' });
  if (price.metadata?.doco_mode !== 'once' || price.metadata?.doco_sku !== 'sample') {
    await stripe.prices.update(price.id, { metadata: { doco_sku: 'sample', doco_mode: 'once' } });
  }
  console.log(JSON.stringify({ environment: production ? 'live' : 'sandbox', product: product.id, price: price.id, amount: price.unit_amount }));
} finally {
  await pool.end();
}
