import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { stripe } from '../server/stripe.mjs';

// Deliberately opt-in: this creates completed SANDBOX payments only.
if (process.env.RUN_SANDBOX_PAYMENTS !== 'yes') {
  throw new Error('Set RUN_SANDBOX_PAYMENTS=yes to submit Stripe test payments.');
}
const base = process.env.TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const ready = await (await fetch(`${base}/api/commerce`)).json();
assert.equal(ready.enabled, true);
assert.equal(ready.testMode, true, 'Refusing to submit payments in live mode');
await mkdir('generated-artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const results = [];
const subscriptions = new Set();
try {
  for (const [name, items, total] of [
    ['one-time', [{ sku: 'multi', mode: 'once', qty: 1 }], 3598],
    ['mixed-monthly', [{ sku: 'multi', mode: 'sub', qty: 1 }, { sku: 'sport', mode: 'once', qty: 1 }], 5548],
  ]) {
    if (process.env.PAYMENT_TEST_CASE && process.env.PAYMENT_TEST_CASE !== name) continue;
    const response = await fetch(`${base}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ items }),
    });
    assert.equal(response.status, 200);
    const { url } = await response.json();
    const id = url.match(/cs_test_[a-zA-Z0-9]+/)?.[0];
    assert.ok(id, 'Refusing a non-sandbox checkout URL');
    const before = await stripe.checkout.sessions.retrieve(id);
    assert.equal(before.livemode, false);
    assert.equal(before.amount_total, total);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // Ensure a verified success clears the real storefront's saved bag.
      await page.goto(base);
      await page.evaluate(items => localStorage.setItem('doco_cart', JSON.stringify(items)), items);
      await page.goto(url);
      await page.locator('#email').fill('checkout-verification@example.com');
      await page.locator('#shippingName').fill('DOCO Sandbox Test');
      await page.getByText('Enter address manually', { exact: true }).click();
      await page.locator('#shippingAddressLine1').fill('123 Test Street');
      await page.locator('#shippingLocality').fill('New York');
      await page.locator('#shippingPostalCode').fill('10001');
      await page.locator('#shippingAdministrativeArea').selectOption('NY');
      await page.locator('#phoneNumber').fill('2015550123');
      // Stripe places an expanded click-area button over the visible card label.
      await page.locator('#payment-method-label-card').click({ force: true });
      await page.locator('#cardNumber').fill('4242424242424242');
      const year = String(new Date().getFullYear() + 3).slice(-2);
      await page.locator('#cardExpiry').fill(`12${year}`);
      await page.locator('#cardCvc').fill('123');
      const saveLink = page.locator('#enableStripePass');
      if (await saveLink.count()) await saveLink.uncheck();
      // Recheck with Stripe immediately before the only payment submit action.
      assert.equal((await stripe.checkout.sessions.retrieve(id)).livemode, false);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(u => u.origin === new URL(base).origin && u.pathname === '/thanks.html',
        { timeout: 90000 });
      await expect(page.locator('.thanks .eyebrow')).toHaveText('Test payment confirmed', { timeout: 20000 });
      const paid = await stripe.checkout.sessions.retrieve(id, { expand: ['subscription'] });
      assert.equal(paid.livemode, false);
      assert.equal(paid.status, 'complete');
      assert.equal(paid.payment_status, 'paid');
      assert.equal(paid.amount_total, total);
      const status = await (await fetch(`${base}/api/checkout-status?${new URL(page.url()).searchParams}`)).json();
      assert.equal(status.paid, true);
      assert.equal(status.testMode, true);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('doco_cart') || '[]')), []);
      await page.screenshot({ path: `generated-artifacts/paid-${name}.png` });
      if (paid.subscription) {
        subscriptions.add(paid.subscription.id);
        assert.equal(paid.subscription.status, 'active');
        const subItems = paid.subscription.items.data;
        assert.ok(subItems.some(i => i.price.unit_amount === 2549 && i.price.recurring.interval === 'month'));
        assert.ok(subItems.some(i => i.price.unit_amount === 599 && i.price.recurring.interval === 'month'));
        assert.equal(subItems.reduce((sum, i) => sum + i.price.unit_amount * i.quantity, 0), 3148);
        assert.ok(!subItems.some(i => i.price.unit_amount === 2999),
          'One-time items must not recur');
        const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
        const config = configs.data.find(c => c.metadata?.doco_portal === 'true');
        assert.ok(config?.features.subscription_cancel.enabled);
        const portal = await stripe.billingPortal.sessions.create({
          customer: paid.customer, configuration: config.id, return_url: base,
          flow_data: { type: 'subscription_cancel',
            subscription_cancel: { subscription: paid.subscription.id } },
        });
        await page.goto(portal.url);
        await expect(page.getByRole('button', { name: /cancel subscription/i })).toBeVisible({ timeout: 20000 });
        await page.screenshot({ path: 'generated-artifacts/subscription-cancel-portal.png' });
        await page.getByRole('button', { name: /cancel subscription/i }).click();
        // New Stripe API versions represent portal period-end cancellation as
        // cancel_at, without setting the legacy cancel_at_period_end flag.
        const periodEnd = Math.max(...subItems.map(i => i.current_period_end));
        await expect.poll(async () => {
          const sub = await stripe.subscriptions.retrieve(paid.subscription.id);
          return sub.status === 'active' &&
            (sub.cancel_at_period_end || sub.cancel_at === periodEnd) &&
            sub.cancellation_details?.reason === 'cancellation_requested';
        },
        { timeout: 20000 }).toBe(true);
        await page.screenshot({ path: 'generated-artifacts/subscription-cancel-confirmed.png' });
        console.log('PASS Stripe subscription portal schedules cancellation at period end');
      }
      results.push({ name, amount: total, sandbox: true, paid: true,
        subscriptionCancellationVerified: !!paid.subscription });
      console.log(`PASS ${name}: completed sandbox payment, server-confirmed paid status, success page and cart cleared`);
    } finally {
      // A test might fail after payment completes. Always discover and clean up
      // its subscription so synthetic customers do not keep renewing.
      const final = await stripe.checkout.sessions.retrieve(id);
      if (!final.livemode && final.subscription) subscriptions.add(final.subscription);
      if (final.status === 'open') await stripe.checkout.sessions.expire(id);
      await context.close();
    }
  }
  await writeFile('generated-artifacts/sandbox-payment-results.json', JSON.stringify(results, null, 2));
} finally {
  for (const id of subscriptions) {
    const sub = await stripe.subscriptions.retrieve(id);
    assert.equal(sub.livemode, false, 'Never clean up a live subscription');
    if (sub.status !== 'canceled') await stripe.subscriptions.cancel(id);
  }
  await browser.close();
}
