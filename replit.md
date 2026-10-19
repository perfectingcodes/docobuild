# DOCO storefront

## Project
Existing static website built with HTML, CSS, and vanilla JavaScript. Preserve the existing structure and stack.

## Run on Replit
Use the **Start application** workflow (or the Run button).

Command: `bash build.sh && python3 -m http.server 5000 --bind 0.0.0.0 --directory dist`

The preview server uses Python's standard library; no package installation or secrets are required. Run rebuilds the static site into `dist/`, then serves that directory. Restart the workflow after source changes.

## Publish
Publishing is configured as a **Static** deployment, with build command `bash build.sh` and public directory `dist`. The build copies only the HTML pages, CSS, JavaScript, and images; workspace files and Git metadata are not published. The Python server is for preview only and is not used in production.

Use Replit's Publish action to put the site live. Changes to the source require republishing to update the live site.

## Pages
- `/` or `/index.html`: home page
- `/shop.html`: shop
- `/product.html?sku=multi`: example product

Styles are in `css/style.css`, behavior and product data in `js/main.js`, and images in `assets/`.

## Existing limitations
Commerce is disabled for the catalog-only launch. The retained cart code uses localStorage when enabled; demo checkout does not take payment or submit real orders. Google Fonts requires an internet connection.

## Stripe integration (planned)
The upstream storefront includes a client-side Stripe Checkout scaffold. This is future reference, not a requirement for publishing the catalog. Before enabling real sales:

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
4. Only after real commerce is requested and tested, configure `checkoutEndpoint` and
   `enabled` in `js/commerce-config.js`, then deliberately update the catalog-only
   guard in `js/main.js`. Configuration alone does not enable ordering for this launch.
5. `thanks.html` is the success page — it clears the visitor's bag and shows the last
   8 characters of the session id as a reference. `shop.html?checkout=canceled` is the cancel page.
6. For fulfillment, add a webhook endpoint for `checkout.session.completed` and verify it
   with `STRIPE_WEBHOOK_SECRET`.

## Launch behavior
The site is a marketing and product catalog launch. Cart, purchase options, quantities, and demo checkout are inaccessible. All purchase buttons say "Launching soon" and are disabled, including quiz recommendations. Launch-update links open the visitor's email app and address the existing business contact; there is no automated newsletter signup.

The imported checkout code is still a demo. Do not enable commerce without replacing it with a real order/payment service and testing fulfillment, subscriptions, shipping, and returns.

Google Fonts requires an internet connection.
