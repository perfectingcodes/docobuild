/* ============================================================
   DOCO commerce UI config. Real prices and payment readiness come from the backend.
   Loaded before js/main.js on every page.

   How it works:
   • enabled:false  → every purchase control reads "Orders opening at launch"
                      and the bag/checkout UI stays hidden (pre-launch mode).
   • enabled:true + checkoutEndpoint → the bag's Checkout button POSTs the
                      cart to the endpoint and redirects to the Stripe
                      Checkout URL the server returns.
   • No endpoint or failed server readiness check → buying stays disabled.

   Server contract:
     POST {checkoutEndpoint}
     body: { items:[{ sku, mode:"once"|"sub", qty }] }
     200:  { url: "https://checkout.stripe.com/c/pay/..." }
   ============================================================ */
window.DOCO_COMMERCE = {
  enabled: true,
  checkoutEndpoint: '/api/create-checkout-session',
  successUrl: '/thanks?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: '/shop?checkout=canceled',
  currency: 'usd',
  freeShippingOver: 45,
  shippingFee: 5.99,
  /* Retained for compatibility only. Checkout resolves approved Stripe Prices
     server-side; never trusts IDs or amounts from the browser. */
  prices: {
    'multi':      { once: '', sub: '' },
    'sport':      { once: '', sub: '' },
    'calm':       { once: '', sub: '' },
    'sleep':      { once: '', sub: '' },
    'duo-domore': { once: '', sub: '' },
    'duo-relax':  { once: '', sub: '' },
    'stack':      { once: '', sub: '' }
  }
};
