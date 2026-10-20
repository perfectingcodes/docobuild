/* ============================================================
   DOCO commerce config — the only file to touch when Stripe goes live.
   Loaded before js/main.js on every page.

   How it works:
   • enabled:false  → every purchase control reads "Orders opening at launch"
                      and the bag/checkout UI stays hidden (pre-launch mode).
   • enabled:true + checkoutEndpoint → the bag's Checkout button POSTs the
                      cart to the endpoint and redirects to the Stripe
                      Checkout URL the server returns.
   • enabled:true, no endpoint → the in-page demo checkout (no payment).

   Server contract (implement on Replit, see replit.md → "Stripe"):
     POST {checkoutEndpoint}
     body: { items:[{ sku, mode:"once"|"sub", qty, price_id, name, unit_amount }],
             success_url, cancel_url, currency }
     200:  { url: "https://checkout.stripe.com/c/pay/..." }
   ============================================================ */
window.DOCO_COMMERCE = {
  enabled: false,
  checkoutEndpoint: '',                 /* e.g. '/api/create-checkout-session' */
  successUrl: 'thanks.html?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'shop.html?checkout=canceled',
  currency: 'usd',
  freeShippingOver: 45,
  shippingFee: 5.99,
  /* Stripe Price IDs — one-time and monthly subscription price per SKU.
     Create them in the Stripe dashboard (Products → Add product) and paste here. */
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
