# DOCO storefront

## Project
Existing HTML/CSS/vanilla JavaScript website, with a small Express payment backend. Preserve the existing frontend design and structure.

## Run on Replit
Use the **Start application** workflow (or the Run button).

Command: `bash build.sh && node server/index.mjs`

Requires Node 22, `npm ci`, Replit PostgreSQL, the connected Stripe integration, and SESSION_SECRET. Run rebuilds the public website into `dist/` and serves only that directory plus `/api`. Restart after source changes.

## Publish
Publishing is configured as **Autoscale** because checkout needs a backend. Build: `npm ci && bash build.sh`. Run: `node server/index.mjs`. Production uses NODE_ENV=production and refuses to start with the wrong Stripe account or payments disabled. The known public URL is https://docobuild.replit.app; if the domain changes, update the server's allowed checkout origin and managed webhook URL after checking publishing information.

Use Replit's Publish action to put the site live. Changes to the source require republishing to update the live site.

## Pages
- `/` or `/index.html`: home page
- `/shop.html`: shop
- `/product.html?sku=multi`: example product

Styles are in `css/style.css`, behavior and product data in `js/main.js`, and images in `assets/`.

## Stripe checkout
- The user approved real one-time and monthly subscription purchases, superseding the original catalog-only launch.
- Development uses the Replit-managed Stripe sandbox. The separate Stripe MCP connection to the live DOCO account does not supply website runtime authentication.
- Connect the live DOCO account through the Publishing pane's Stripe setup before republishing. Do not mix manually copied API keys with the managed connector.
- The server uses the connectors SDK for credential-free transport of Stripe SDK requests. No Stripe API key enters the public website.
- Stripe data is synced with stripe-replit-sync into its managed schema. Products/Prices are not duplicated into application tables.
- Catalog initialization reuses existing matching products/prices or idempotently creates missing ones in the connected account. All prices are USD: individual formulas $29.99 / $25.49 monthly; duos $44.99 / $38.24 monthly; Variety Pack $79.99 / $71.99 monthly.
- Shipping is US-only, $5.99, free when the shipment's product subtotal is strictly over $45. Subscription shipping renews monthly; mixed carts use a first-invoice shipping discount if the initial shipment qualifies but subsequent shipments do not.
- The browser sends SKU, purchase mode and quantity only. The server resolves active Stripe Price IDs and ignores client amounts, redirect URLs and price IDs.
- Checkout requests are idempotent. The thank-you page requires a server-verified paid Stripe session plus a signed confirmation proof before clearing the bag.
- Footer subscription management opens Stripe's secure email-login billing portal. Customers can cancel at period end, update payment methods and view invoices.
- Production registers the public `/api/stripe/webhook` using stripe-replit-sync; signatures are checked on raw request bodies. The private development preview is intentionally not a webhook destination.
- Fulfill physical orders and handle refunds in Stripe Dashboard/manual operations. No automatic shipping-label, inventory, tax collection or warehouse fulfillment service is connected; the website does not promise automatic receipts or tracking emails.
- Launch-update email links are manual mailto links, not an automated mailing list.

## Verification
`npm test` covers cart validation, server-authoritative prices, shipping boundaries, all seven SKUs and both purchase modes, recurring shipping and mixed-cart first-shipment discounts.
`npm run test:checkout` exercises the running sandbox API, including Stripe session totals, idempotency, invalid requests, confirmation proofs and private-file protection. `npm run test:browser` exercises the mobile cart and real Stripe redirect; set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an available Chromium binary. Generated screenshots are excluded from Git and publishing.
`npm run stripe:check` audits the connected account, all product prices, shipping prices, and subscription management without modifying Stripe. `RUN_SANDBOX_PAYMENTS=yes npm run test:payments` completes representative sandbox payments and tests the hosted subscription cancellation portal, then cleans up test subscriptions.
See `docs/stripe-readiness.md` for the product readiness matrix, test results, and live authorization checks still required. A sandbox test result must not be described as proof of live readiness.
Browser and API checks must use the sandbox only. Never submit a live charge as a test.

Google Fonts requires an internet connection.
