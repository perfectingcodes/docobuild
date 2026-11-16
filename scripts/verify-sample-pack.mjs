import { chromium, expect } from '@playwright/test';

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const state = await (await fetch(`${base}/api/commerce`)).json();
if (!state.enabled || !state.testMode) throw new Error('Sample Pack browser check requires sandbox checkout.');
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  headless: true, args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/shop`);
  const card = page.locator('.pcard').filter({ has: page.locator('[data-add="sample"]') });
  await expect(card).toContainText('Sample Pack');
  await expect(card).toContainText('$11.99');
  await expect(card.locator('.pcard__pouch')).toHaveAttribute('src', 'assets/pouch-stack.webp');
  await card.locator('.pcard__link').tap();
  await expect(page.locator('.pdp__info h1')).toHaveText('Sample Pack');
  await expect(page.locator('.pdp__perks')).toContainText('4 strips');
  await expect(page.locator('.pdp__info [data-mode="sub"]')).toHaveCount(0);
  await expect(page.locator('.pdp__buy')).toContainText('$11.99');
  await expect(page.locator('#pdp')).not.toContainText('NaN');
  await page.locator('.pdp__buy [data-add="sample"]').tap();
  await page.locator('#cartBtn').tap();
  await expect(page.locator('#bagSub')).toHaveText('$11.99');
  await expect(page.locator('#bag')).toContainText('Sample Pack');
  await page.locator('#checkoutBtn').tap();
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 45000 });
  await page.waitForLoadState('domcontentloaded');
  if (errors.length) throw new Error(errors.join('; '));
  console.log('PASS mobile Sample Pack shop → details (4 strips, $11.99, matching image, one-time only) → bag → sandbox Stripe checkout');
} finally {
  await browser.close();
}
