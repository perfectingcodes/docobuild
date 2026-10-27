# DOCO Stripe readiness

Verified October 27, 2026. **Sandbox payments and the live catalog are verified. The production code passes live-account readiness checks before publishing. The public checkout and webhook still require republishing and external verification.**

## Products

All listed products have active matching USD prices in both sandbox and live Stripe. Actual sandbox Checkout sessions were tested for every row and both purchase options, including quantity, totals, US-only address collection, and confirmation protection. The live product/price mapping was checked without creating live checkout sessions or payments.

| Product | One-time | Monthly | Sandbox checkout | Live catalog |
| --- | ---: | ---: | --- | --- |
| Multivitamin DOCO Strips | $29.99 | $25.49 | Both passed | Both verified |
| Sports Energy DOCO Strips | $29.99 | $25.49 | Both passed | Both verified |
| Calm + Stress DOCO Strips | $29.99 | $25.49 | Both passed | Both verified |
| Sleep Strips | $29.99 | $25.49 | Both passed | Both verified |
| The Do More Duo | $44.99 | $38.24 | Both passed | Both verified |
| The Relaxation Duo | $44.99 | $38.24 | Both passed | Both verified |
| The Variety Pack | $79.99 | $71.99 | Both passed | Both verified |

Shipping is $5.99 per shipment, free when that shipment's product subtotal is strictly greater than $45. The $45 boundary, free monthly shipping, and mixed-cart first-shipment shipping waiver were checked.

## Completed payment tests

- A $35.98 one-time order completed using Stripe's public sandbox test card.
- A $55.48 mixed order completed with a monthly subscription. Its first shipment had free shipping; the recurring products and shipping total was $31.48/month. The one-time product was not included in recurring billing.
- Both thank-you pages retrieved server-confirmed paid status and cleared the saved bag.
- Stripe's hosted subscription portal successfully scheduled cancellation at the billing period end. The test subscriptions were then immediately canceled for cleanup; no synthetic subscription remains renewing.
- Canceling an unpaid checkout retained the bag. Invalid confirmation links could not display a paid result.
- Invalid carts, unapproved checkout origins, unsigned webhooks, and access to private server files were rejected.
- Development checkout now requires sandbox prices for every product and shipping option; production requires matching live prices. A single live price cannot incorrectly enable a partly configured catalog.
- These were sandbox transactions, not real charges or shipment requests.

## Live-account checks completed

- The native website integration has separate development and production connections. Connection selection uses their environment, not the order of returned connections.
- The production connection resolves to DOCO The Do Company LLC, with charges and payouts enabled and no currently due activation requirements at inspection.
- The merchant's fourteen existing live products/prices were reused, including separate subscription products and the merchant's “The More Duo” naming. No product or advertised price was replaced or deleted.
- Matching one-time and monthly shipping prices and the shipping-only first-invoice discount are configured in live Stripe.
- A live Stripe billing portal is configured for payment-method updates, invoices, and cancellation at the end of the billing period.
- The production commerce code was run privately against the live account and returned `enabled=true`, `testMode=false`, and the live subscription portal.
- No live checkout session, customer, subscription, invoice, or charge was created by these checks. Only sandbox payments were submitted.

## Checks still blocked

At the time of this check, the published site was still a static deployment and its `/api/commerce` route returned 404. The checkout backend changes have not been published.

An attempted backend publish logged Stripe startup failures and did not replace the older working deployment. The same failure was reproduced in the workspace: both environment connections were present, while the old transport required exactly one connection globally. That selection bug is now fixed and covered by tests, including a passing production-code check against the live account.

The merchant confirmed completing live-account authorization in Publishing. The production website connection is now available and its catalog checks pass. Applying the updated backend to the public site remains blocked on the merchant clicking Republish.

Real signed Stripe webhook delivery has not been tested end to end. The private development preview is intentionally not registered as a webhook destination. The public production backend and its managed webhook must be checked after authorization and republishing.

## Merchant authorization and launch

1. Open Replit **Publishing**. Live Stripe authorization and the live catalog checks are already complete.
2. Republish the app with its configured Autoscale backend deployment. Only the merchant should click Publish.
3. Verify the published `/api/commerce` reports enabled live checkout, all fourteen live product options match the approved prices, the live subscription portal works, and the managed webhook is active and receiving valid signed events. Do not submit a real charge as a test.

Do not describe live sales as ready until those checks are complete. Automatic sales tax and automated fulfillment remain outside this work.

## Repeatable checks

- `npm test`: cart rules, shipping boundaries, catalog environment separation, and subscription management readiness.
- `npm run stripe:check`: read-only audit of the currently connected account's catalog and portal. Does not seed or mutate Stripe.
- `npm run test:checkout`: real sandbox session checks for all fourteen product/purchase options and mixed carts.
- `npm run test:browser`: mobile selection, bag, hosted checkout redirect, and false-confirmation protection.
- `RUN_SANDBOX_PAYMENTS=yes npm run test:payments`: opt-in completed sandbox payment and subscription portal cancellation tests. Requires an installed Playwright Chromium browser or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; test subscriptions are cleaned up.
- `NODE_ENV=production npm run test:live-readiness`: verifies the native live account, all fourteen mapped prices, shipping, the shipping-only coupon, and production commerce readiness privately. Refreshes the local catalog cache but does not create Stripe transactions or publish.
