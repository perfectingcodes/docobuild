import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { stripe, pool } from '../server/stripe.mjs';

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
assert.equal((await (await fetch(`${base}/api/commerce`)).json()).testMode, true);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] });
try {
  const sessions = [];
  for (const [name, items, amount, shipping] of [
    ['sample alone', [{ sku: 'sample', mode: 'once', qty: 1 }], 1199, 0],
    ['sample + multivitamin', [{ sku: 'sample', mode: 'once', qty: 1 }, { sku: 'multi', mode: 'once', qty: 1 }], 4797, 599],
    ['samples do not unlock shipping', [{ sku: 'sample', mode: 'once', qty: 4 }, { sku: 'duo-domore', mode: 'once', qty: 1 }], 9894, 599],
    ['other items qualify normally', [{ sku: 'sample', mode: 'once', qty: 1 }, { sku: 'multi', mode: 'once', qty: 2 }], 7197, 0],
  ]) {
    const res = await fetch(`${base}/api/create-checkout-session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ items }),
    });
    assert.equal(res.status, 200);
    const checkout = await res.json();
    const id = checkout.url.match(/cs_test_[a-zA-Z0-9]+/)?.[0];
    assert.ok(id, 'Sandbox checkout only');
    const session = await stripe.checkout.sessions.retrieve(id);
    assert.equal(session.livemode, false);
    assert.equal(session.amount_total, amount);
    assert.equal(checkout.total, amount / 100);
    const lines = await stripe.checkout.sessions.listLineItems(id);
    const shippingLine = lines.data.filter(l => l.price.unit_amount === 599);
    assert.equal(shippingLine.reduce((s, l) => s + l.amount_total, 0), shipping);
    assert.ok(session.success_url.startsWith(`${base}/thanks.html?session_id={CHECKOUT_SESSION_ID}&proof=`));
    sessions.push({ id, session, checkout });
    console.log(`PASS Stripe test mode: ${name}, total $${(amount / 100).toFixed(2)}, shipping $${(shipping / 100).toFixed(2)}`);
  }

  // Use the real base bootstrap while capturing Meta calls locally, so synthetic
  // test orders do not pollute the merchant's advertising conversions.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    window.metaCalls = [];
    const push = (args) => {
      window.metaCalls.push(Array.from(args));
      if (window.captureMeta) window.captureMeta(Array.from(args));
    };
    Object.defineProperty(window, 'fbq', { configurable: true, get() { return this.__pixel; }, set(fn) {
      fn.callMethod = function () { push(arguments); }; this.__pixel = fn;
    } });
  });
  await context.route('https://connect.facebook.net/**', r => r.fulfill({ contentType: 'application/javascript', body: '/* analytics network suppressed during automated test */' }));
  await context.route('https://www.facebook.com/**', r => r.abort());
  const observed = [];
  await context.exposeFunction('captureMeta', args => observed.push(args));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const route of ['/', '/shop', '/product?sku=sample', '/creators', '/thanks', '/admin', '/not-a-page']) {
    await page.goto(base + route);
    await page.waitForFunction(() => typeof fbq === 'function');
    assert.ok(await page.evaluate(() => metaCalls.some(c => c[0] === 'init' && c[1] === '1743915574010251')));
    assert.ok(await page.evaluate(() => metaCalls.some(c => c[1] === 'PageView')));
  }
  console.log('PASS fbq initialized with PageView on every page, including admin and 404');
  await page.goto(`${base}/product?sku=sample`);
  await expect(page.locator('.pdp__info h1')).toHaveText('Sample Pack');
  await expect(page.locator('.pdp__info')).toContainText('$11.99 - Free US shipping');
  const ld = JSON.parse(await page.locator('#pdpLd').textContent());
  assert.equal(ld['@graph'][0].offers[0].price, '11.99');
  assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).includes('$11.99'));
  const view = await page.evaluate(() => metaCalls.find(c => c[1] === 'ViewContent'));
  assert.deepEqual(view[2], { content_ids: ['sample'], content_type: 'product', value: 11.99, currency: 'USD' });
  await page.locator('.pdp__buy [data-add="sample"]').tap();
  const add = await page.evaluate(() => metaCalls.find(c => c[1] === 'AddToCart'));
  assert.equal(add[2].value, 11.99);
  assert.deepEqual(add[2].content_ids, ['sample']);
  await page.locator('#cartBtn').tap();
  await expect(page.locator('#bagSub')).toHaveText('$11.99');
  await expect(page.locator('.bag__note')).toContainText('Shipping: free');
  await page.locator('#checkoutBtn').tap();
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 60000 });
  assert.ok(observed.some(c => c[1] === 'InitiateCheckout' && c[2].value === 11.99 && c[2].num_items === 1));
  console.log('PASS mobile product price, metadata, ViewContent, AddToCart and InitiateCheckout');

  if (process.env.RUN_SANDBOX_PAYMENTS !== 'yes') throw new Error('Opt in to complete a sandbox payment');
  const id = page.url().match(/cs_test_[a-zA-Z0-9]+/)?.[0];
  assert.ok(id);
  assert.equal((await stripe.checkout.sessions.retrieve(id)).livemode, false);
  await page.waitForLoadState('domcontentloaded');
  await page.screenshot({ path: 'generated-artifacts/sample-stripe-checkout.png' });
  const form = page.frameLocator('iframe[src*="elements-inner-habanero"]');
  await form.locator('[name="email"]').fill('checkout-verification@example.com');
  await form.locator('#shippingAddress-nameInput').fill('DOCO Sandbox Test');
  await form.locator('#shippingAddress-addressLine1Input').fill('123 Test Street');
  await form.locator('#shippingAddress-localityInput').fill('New York');
  await form.locator('#shippingAddress-postalCodeInput').fill('10001');
  await form.locator('#shippingAddress-administrativeAreaInput').selectOption('NY');
  await form.locator('#shippingAddress-phoneInput').fill('2015550123');
  await form.getByText('Card', { exact: true }).click();
  await form.locator('[name="number"]').fill('4242424242424242');
  await form.locator('[name="expiry"]').fill(`12${String(new Date().getFullYear() + 3).slice(-2)}`);
  await form.locator('[name="cvc"]').fill('123');
  if (await form.locator('[name="linkOptIn"]').count()) await form.locator('[name="linkOptIn"]').uncheck();
  await form.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.waitForURL(u => u.origin === new URL(base).origin && ['/thanks', '/thanks.html'].includes(u.pathname), { timeout: 90000 });
  await expect(page.locator('.thanks .eyebrow')).toHaveText('Test payment confirmed', { timeout: 30000 });
  const paid = await stripe.checkout.sessions.retrieve(id);
  assert.equal(paid.payment_status, 'paid');
  assert.equal(paid.amount_total, 1199);
  const purchase = await page.evaluate(() => metaCalls.filter(c => c[1] === 'Purchase'));
  assert.equal(purchase.length, 1);
  assert.deepEqual(purchase[0][2], { value: paid.amount_total / 100, currency: 'USD', content_ids: ['sample'], content_type: 'product' });
  assert.deepEqual(purchase[0][3], { eventID: id });
  await page.reload();
  await expect(page.locator('.thanks .eyebrow')).toHaveText('Test payment confirmed', { timeout: 30000 });
  assert.equal(await page.evaluate(() => metaCalls.filter(c => c[1] === 'Purchase').length), 0);
  await page.screenshot({ path: 'generated-artifacts/sample-pixel-success.png' });
  assert.deepEqual(errors, []);
  console.log('PASS completed real Stripe sandbox payment: Purchase uses session amount_total/content_ids/eventID; refresh does not fire again');
  for (const { id } of sessions) await stripe.checkout.sessions.expire(id);
  await context.close();
} finally {
  await browser.close();
  await pool.end();
}
