# DOCO storefront

## Project
Existing static website built with HTML, CSS, and vanilla JavaScript. Preserve the existing structure and stack.

## Run on Replit
Use the **Start application** workflow (or the Run button).

Command: `python3 -m http.server 5000 --bind 0.0.0.0`

The server uses Python's standard library; no package installation, build step, or secrets are required. This is a development preview server, not a production server.

## Pages
- `/` or `/index.html`: home page
- `/shop.html`: shop
- `/product.html?sku=multi`: example product

Styles are in `css/style.css`, behavior and product data in `js/main.js`, and images in `assets/`.

## Existing limitations
The cart is stored in the visitor's browser using localStorage. Checkout is explicitly a demo and does not take payment or submit real orders. Google Fonts requires an internet connection.

## Stripe integration (planned)
The storefront is already wired for Stripe Checkout on the client. To go live:

1. Create one Product per SKU in Stripe with two Prices each: a one-time price and a monthly
   recurring price. SKUs: `multi`, `sport`, `calm`, `sleep` ($29.99 / $25.49 mo),
   `duo-domore`, `duo-relax` ($44.99 / $38.24 mo), `stack` ($79.99 / $71.99 mo).
2. Paste the Price IDs into `js/commerce-config.js` → `prices`.
3. Add a small backend (any language) that exposes `POST /api/create-checkout-session`:
   - reads `{ items, success_url, cancel_url, currency }` from the JSON body
     (`items[]` = `{ sku, mode: "once"|"sub", qty, price_id, name, unit_amount }`),
   - creates a Stripe Checkout Session with `line_items: [{ price: price_id, quantity: qty }]`,
     `mode: "subscription"` if any item has `mode: "sub"`, else `"payment"`,
     `shipping_address_collection` + `shipping_options` (free over $45, otherwise $5.99),
     `success_url` / `cancel_url` passed through (`{CHECKOUT_SESSION_ID}` is already in success_url),
   - returns `{ "url": session.url }` with status 200.
   Secrets: `STRIPE_SECRET_KEY` (Replit Secrets). Never put the secret key in client files.
4. Set `checkoutEndpoint: '/api/create-checkout-session'` and `enabled: true` in
   `js/commerce-config.js`. That single change turns on the bag, the mode toggles and
   the Add-to-bag buttons site-wide.
5. `thanks.html` is the success page — it clears the visitor's bag and shows the last
   8 characters of the session id as a reference. `shop.html?checkout=canceled` is the cancel page.
6. For fulfillment, add a webhook endpoint for `checkout.session.completed` and verify it
   with `STRIPE_WEBHOOK_SECRET`.
