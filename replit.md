# DOCO storefront

## Project
Existing HTML/CSS/vanilla JavaScript website, with a small Express payment backend. Preserve the existing frontend design and structure.

## Run on Replit
Use the **Start application** workflow (or the Run button).

Command: `bash build.sh && node server/index.mjs`

Requires Node 22, `npm ci`, Replit PostgreSQL, the connected Stripe integration, and SESSION_SECRET. Run rebuilds the public website into `dist/` and serves only that directory plus `/api`. Restart after source changes.

## Publish
Publishing is configured as **Autoscale** because checkout needs a backend. Build: `npm ci && bash build.sh`. Run: `node server/index.mjs`. Production uses NODE_ENV=production and refuses to start with the wrong Stripe account or payments disabled. The verified public domains are https://docostrips.com (primary) and https://docobuild.replit.app. If domains change, verify publishing information and update the explicit checkout-origin allowlist and managed webhook URL. Never derive approved redirect origins from untrusted request headers.

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
- Both environment connections coexist after live activation. The runtime explicitly selects the enabled development or production connection; never require exactly one Stripe connection across all environments.
- Stripe data is synced with stripe-replit-sync into its managed schema. Products/Prices are not duplicated into application tables.
- Startup validates existing catalog records and refreshes their local synchronized cache; it never creates or updates Stripe products, prices, coupons, or portal settings. Explicit sandbox setup is available through `npm run seed:stripe`; production seed is verification-only.
- Live catalog identities are explicit in `server/live-catalog.mjs`. The account contains both original separate subscription products and additional same-name/shared-price products. Names and SKU metadata are not unique. Startup and checkout share the same identity selection; do not pick by list order, silently substitute a copied record, or delete live products to resolve ambiguity. Verify approved replacement identities intentionally before editing the mapping.
- All prices are USD: individual formulas $29.99 / $25.49 monthly; duos $44.99 / $38.24 monthly; Variety Pack $79.99 / $71.99 monthly. Missing, inactive, wrong-mode, wrong-amount, or wrong-environment mapped records fail closed. Sandbox supports shared or separate products, but unconfigured matching price duplicates remain errors.
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
`NODE_ENV=production npm run test:live-readiness` checks all approved live prices, shipping, the shipping-only coupon and the production commerce route privately. It refreshes local synced data but creates no live Stripe transaction and does not publish.
See `docs/stripe-readiness.md` for the product readiness matrix, test results, and live authorization checks still required. A sandbox test result must not be described as proof of live readiness.
Browser and API checks must use the sandbox only. Never submit a live charge as a test.

Google Fonts requires an internet connection.

## Admin dashboard (owner only)
- URL: `/admin.html` on the same site. Not linked publicly; `noindex`.
- Sign-in password comes from the `ADMIN_PASSWORD` secret. Until it is set the fallback is `domore` — set the secret in Replit Secrets before sharing the URL, then restart/republish.
- Sessions are signed cookies (`SESSION_SECRET`), 12 hours, HttpOnly, SameSite=Strict, Secure in production. Login is rate limited.
- Routes live in `server/admin.mjs` and are mounted in `server/app.mjs`; `ensureAdminTables()` creates `public.site_events` and `public.creator_applications` at startup (`server/index.mjs`).
- Orders and subscriptions are read live from Stripe through the existing connector (`checkout.sessions.list` with `doco_checkout` metadata, paid only, environment-matched; `subscriptions.list`), cached for 60 seconds. CSV export at `/api/admin/orders.csv`.
- Site analytics are first-party: the browser posts anonymous events (`pageview`, `add_to_cart`, `cart_update`, `checkout_start`, `quiz_complete`, `builder_pick`, `creator_apply`) to `POST /api/track` with a random session id; no names, emails or IPs are stored. "Carts" shows the latest cart snapshot per session over 7 days for sessions that have not started checkout.
- `tests/admin.test.mjs` covers token signing, password checks, event sanitizing and aggregation; it runs with `npm test`.

## Creators & partners page
- `/creators.html` with an application form posting to `POST /api/creators` (rate limited, stored in `public.creator_applications`); applications appear under the Admin → Creators tab with a status selector.
- Program terms shown on the page (20% commission, 15% audience code, free monthly box) are placeholders chosen for launch copy. Change them in `creators.html` (perks + steps copy) and `js/creators.js` (`TERMS` for the earnings illustration).

## Welcome offer popup
- First visit to the home page shows a 10%-off email popup (`js/main.js`, after 6 s or 35% scroll; remembered in localStorage). Emails post to `POST /api/subscribe` and are stored in `public.email_signups` (unique by email); they appear under Admin → Emails with CSV export.
- The code shown is `WELCOME_CODE` (default `LETSGO10`). **Create a matching promotion code in the Stripe dashboard** (10% off, limit to first-time customers, optionally one use per customer). Checkout sessions now set `allow_promotion_codes: true` except for mixed carts that already carry the first-shipment coupon (Stripe does not allow both).
- No automated welcome email is sent yet; the popup shows the code on screen. Wire an email provider later if you want the code delivered by email.
