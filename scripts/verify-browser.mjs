import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const state = await (await fetch(`${base}/api/commerce`)).json();
if (!state.enabled || !state.testMode) throw new Error('Browser testing requires enabled sandbox checkout.');
const browser = await chromium.launch({
  headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
await mkdir('generated-artifacts', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/product.html?sku=multi`);
  await expect(page.locator('.launch-notice')).toContainText('Test store', { timeout: 20000 });
  await expect(page.locator('#cartBtn')).toBeVisible();
  await page.locator('.pdp__info [data-mode="sub"]').click();
  await expect(page.locator('.pdp__buy [data-add]')).toContainText('$25.49');
  await page.locator('.pdp__buy [data-add]').click();
  await page.locator('#cartBtn').click();
  await expect(page.locator('#bag')).toHaveClass(/open/);
  await expect(page.locator('.bag__note')).toContainText('$25.49/month + $5.99');
  await expect(page.locator('.line__meta')).toContainText('Subscribe');
  await page.screenshot({ path: 'generated-artifacts/monthly-cart-mobile.png', fullPage: true });
  await page.locator('#checkoutBtn').click();
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 45000 });
  await page.waitForLoadState('domcontentloaded');
  console.log('PASS mobile subscription selection → bag with renewal disclosure → genuine sandbox Stripe checkout');
  // Hosted payment form is Stripe-controlled. Do not submit any real payment.
  console.log('Hosted checkout title:', await page.title());
  await page.screenshot({ path: 'generated-artifacts/stripe-sandbox-checkout.png' });
  await page.goto(`${base}/shop.html?checkout=canceled`);
  await expect(page.locator('#toast')).toContainText('Checkout canceled', { timeout: 20000 });
  await page.locator('#cartBtn').click();
  await expect(page.locator('.line__meta')).toContainText('Subscribe');
  await page.locator('[data-line-qty="1"]').click();
  await expect(page.locator('#bagSub')).toHaveText('$50.98');
  await expect(page.locator('.bag__note')).toContainText('free US shipping');
  await page.locator('[data-rm]').click();
  await expect(page.locator('#checkoutBtn')).toBeDisabled();
  await page.goto(`${base}/thanks.html`);
  await expect(page.locator('.thanks h1')).toHaveText('No payment confirmed.', { timeout: 20000 });
  await page.goto(`${base}/thanks.html?session_id=fake&proof=fake`);
  await expect(page.locator('.thanks h1')).toHaveText('We could not verify payment.', { timeout: 20000 });
  await page.goto(`${base}/product.html?sku=constructor`);
  await expect(page.locator('.pdp__info h1')).toHaveText('Multivitamin', { timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('doco_cart', '{"invalid":true}'));
  await page.reload();
  await expect(page.locator('#cartBtn')).toContainText('0', { timeout: 20000 });
  await expect(page.locator('a[href^="https://billing.stripe.com/"]')).toHaveText('Manage subscriptions');
  await page.goto(`${base}/shop.html`);
  const card = page.locator('.pcard').first();
  const pouch = card.locator('.pcard__pouch');
  await expect(pouch).toBeVisible();
  await expect(pouch).toHaveJSProperty('complete', true);
  await card.locator('[data-add]').tap();
  await expect(page.locator('#cartCount')).toHaveText('1');
  await expect(pouch).toHaveCSS('opacity', '1');
  await expect(pouch).toBeVisible();
  await page.screenshot({ path: 'generated-artifacts/mobile-card-after-add.png' });
  // Exercise the sticky-hover state explicitly: touch browsers may retain :hover after tapping.
  await card.hover();
  await expect(pouch).toHaveCSS('opacity', '1');
  await page.locator('#cartBtn').tap();
  await expect(page.locator('.line')).toHaveCount(1);
  await page.locator('#checkoutBtn').tap();
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 45000 });
  console.log('PASS touch mobile card image remains visible after add/sticky hover → one-time sandbox checkout');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log('PASS canceled checkout preserves bag, quantity/remove, false confirmation protection, invalid SKU/cart resilience and management link');
} finally {
  await browser.close();
}
