import { initializeStripe, initializeProductionWebhooks } from './stripe.mjs';
import { app } from './app.mjs';
import { ensureCatalog } from '../scripts/seed-products.mjs';
import { ensureAdminTables } from './admin.mjs';
import { pool } from './stripe.mjs';

try {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');
  await initializeStripe();
  await ensureCatalog();
  await ensureAdminTables(pool);
  await initializeProductionWebhooks();
  app.listen(Number(process.env.PORT || 5000), '0.0.0.0', () => console.log('DOCO checkout server listening on port 5000'));
} catch (error) {
  console.error('Startup failed:', error.message);
  process.exit(1);
}
