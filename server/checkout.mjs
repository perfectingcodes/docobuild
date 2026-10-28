import { CATALOG, normalizeCart, cartTotals } from './catalog.mjs';

export function buildCheckout(items, prices, { successUrl, cancelUrl, requestId }) {
  const cart = normalizeCart(items);
  const totals = cartTotals(cart);
  const line_items = cart.map(item => {
    const price = prices.find(p => p.sku === item.sku && p.mode === item.mode &&
      p.unit_amount === CATALOG[item.sku][item.mode]);
    if (!price) throw new Error(`Checkout is not configured for ${CATALOG[item.sku].name}. Please contact us.`);
    return { price: price.id, quantity: item.qty };
  });
  const shippingMode = totals.monthly ? 'sub' : 'once';
  const shipping = totals.monthly ? totals.monthlyShipping : totals.firstShipping;
  if (shipping) {
    const price = prices.find(p => p.sku === '_shipping' && p.mode === shippingMode && p.unit_amount === 599);
    if (!price) throw new Error('Shipping is not configured. Please contact us.');
    line_items.push({ price: price.id, quantity: 1 });
  }
  return {
    mode: totals.monthly ? 'subscription' : 'payment',
    line_items,
    shipping_address_collection: { allowed_countries: ['US'] },
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    success_url: successUrl, cancel_url: cancelUrl,
    metadata: { doco_checkout: 'true', checkout_request_id: requestId },
    ...(totals.monthly ? {
      subscription_data: { metadata: { doco_subscription: 'true', shipping_country: 'US' } },
    } : { customer_creation: 'always' }),
    ...(totals.monthlyShipping && !totals.firstShipping ? {
      discounts: [{ coupon: 'doco-first-shipping-free' }],
    } : {
      // Lets customers enter the welcome code (e.g. LETSGO10) in Stripe Checkout.
      // Stripe does not allow this together with a preset discount.
      allow_promotion_codes: true,
    }),
    // No unapproved tax assumptions or tax-rate changes. Stripe totals are final.
    custom_text: {
      submit: { message: totals.monthly
        ? `Subscriptions renew monthly until canceled. Monthly products: $${(totals.monthly / 100).toFixed(2)}; monthly shipping: $${(totals.monthlyShipping / 100).toFixed(2)}. Manage or cancel through our subscription management link.`
        : 'Ships within the United States. Contact DOCO for shipping and returns questions.' },
    },
  };
}
