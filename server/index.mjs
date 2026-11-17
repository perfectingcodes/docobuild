import { initializeStripe, initializeProductionWebhooks, stripe, getStripeSync } from './stripe.mjs';
import { app, studio } from './app.mjs';
import { synchronizeCheckoutCatalog } from './catalog-resolution.mjs';
import { ensureAdminTables } from './admin.mjs';
import { ensureStudioTables } from './studio.mjs';
import { pool } from './stripe.mjs';
import { initializeMailer } from './mailer.mjs';

try {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');
  await initializeStripe();
  await synchronizeCheckoutCatalog({
    stripe, sync: getStripeSync(), production: process.env.NODE_ENV === 'production',
  });
  await ensureAdminTables(pool);
  await ensureStudioTables(pool);
  try {
    console.log(await initializeMailer() ? 'Resend integration connected' : 'Resend not configured; email sending disabled');
  } catch {
    // An email connection problem must not take down the storefront.
    console.error('Resend initialization failed; email sending disabled');
  }
  await initializeProductionWebhooks();
  studio.startSweeps();
  app.listen(Number(process.env.PORT || 5000), '0.0.0.0', () => console.log('DOCO checkout server listening on port 5000'));
} catch (error) {
  console.error('Startup failed:', error.message);
  process.exit(1);
}
