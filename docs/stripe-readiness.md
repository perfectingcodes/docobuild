# DOCO Stripe readiness

Verified October 27, 2026. **Sandbox checkout is verified. Live sales are not yet verified or enabled.**

## Products

All listed products have active matching USD prices in the website's connected sandbox. Actual Stripe Checkout sessions were tested for every row and both purchase options, including quantity, totals, US-only address collection, and confirmation protection.

| Product | One-time | Monthly | Sandbox checkout | Live catalog |
| --- | ---: | ---: | --- | --- |
| Multivitamin DOCO Strips | $29.99 | $25.49 | Both passed | Not verified |
| Sports Energy DOCO Strips | $29.99 | $25.49 | Both passed | Not verified |
| Calm + Stress DOCO Strips | $29.99 | $25.49 | Both passed | Not verified |
| Sleep Strips | $29.99 | $25.49 | Both passed | Not verified |
| The Do More Duo | $44.99 | $38.24 | Both passed | Not verified |
| The Relaxation Duo | $44.99 | $38.24 | Both passed | Not verified |
| The Variety Pack | $79.99 | $71.99 | Both passed | Not verified |

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

## Checks still blocked

The website connection currently resolves to **docobuild Sandbox**, not the live DOCO merchant connection. The separate live-account MCP connection is unreachable, so no fresh live-account catalog or payment-capability audit was possible. Sandbox readiness does not prove the live catalog exists.

At the time of this check, the published site was still a static deployment and its `/api/commerce` route returned 404. The checkout backend changes have not been published.

Real signed Stripe webhook delivery has not been tested end to end. The private development preview is intentionally not registered as a webhook destination. The public production backend and its managed webhook must be checked after authorization and republishing.

## Merchant authorization and launch

1. Open Replit **Publishing** and choose **Adjust settings**.
2. In the Stripe setup, choose **Install Stripe app** and authorize **Replit Integrated Payments** with the intended live DOCO merchant account in Stripe.
3. Complete any live-account verification Stripe requests, then return to Replit. Do not paste API keys into chat or mix manually copied keys with the managed integration.
4. Confirm live products/prices and live payment capability through the managed publishing flow before enabling sales. Reuse matching existing records and do not duplicate or delete unrelated products.
5. Republish the app with its configured backend deployment. Only the merchant should click Publish.
6. Verify the published `/api/commerce` reports enabled live checkout, all fourteen live product options match the approved prices, the live subscription portal works, and the managed webhook is active and receiving valid signed events. Do not submit a real charge as a test.

Do not describe live sales as ready until those checks are complete. Automatic sales tax and automated fulfillment remain outside this work.

## Repeatable checks

- `npm test`: cart rules, shipping boundaries, catalog environment separation, and subscription management readiness.
- `npm run stripe:check`: read-only audit of the currently connected account's catalog and portal. Does not seed or mutate Stripe.
- `npm run test:checkout`: real sandbox session checks for all fourteen product/purchase options and mixed carts.
- `npm run test:browser`: mobile selection, bag, hosted checkout redirect, and false-confirmation protection.
- `RUN_SANDBOX_PAYMENTS=yes npm run test:payments`: opt-in completed sandbox payment and subscription portal cancellation tests. Requires an installed Playwright Chromium browser or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; test subscriptions are cleaned up.
