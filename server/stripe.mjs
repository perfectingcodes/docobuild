import Stripe from 'stripe';
import { ReplitConnectors } from '@replit/connectors-sdk';
import { StripeSync, runMigrations } from 'stripe-replit-sync';
import pg from 'pg';

const connectors = new ReplitConnectors();
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
let selectedConnection;

// The connected integration owns the credentials; no API key is exposed to code.
async function connectorFetch(url, options = {}) {
  if (!selectedConnection) {
    const rows = await connectors.listConnections({ connector_names: 'stripe' });
    if (rows.length !== 1) throw new Error('Exactly one website Stripe connection is required.');
    selectedConnection = rows[0].id;
  }
  const parsed = new URL(url);
  if (parsed.hostname !== 'api.stripe.com') throw new Error('Unexpected Stripe API host');
  const headers = Object.fromEntries(new Headers(options.headers).entries());
  delete headers.authorization;
  delete headers['content-length'];
  return connectors.proxy('stripe', parsed.pathname + parsed.search, {
    connectionId: selectedConnection, method: options.method || 'GET',
    headers, body: options.body,
  });
}

export const stripe = new Stripe('connector-managed-auth', {
  // Non-secret SDK marker only. Replit replaces authentication in the transport.
  httpClient: Stripe.createFetchHttpClient(connectorFetch),
  maxNetworkRetries: 2,
  timeout: 25000,
});
let sync;
export let account;
export async function initializeStripe() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  account = await stripe.accounts.retrieve();
  if (process.env.NODE_ENV === 'production' &&
      (!account.charges_enabled || account.id !== 'acct_1UQY8SG2IwfaSIOP')) {
    throw new Error('Connect the live DOCO Stripe account with payments enabled before publishing.');
  }
  // Refuse live credentials in preview before any setup script can mutate data.
  const sample = await stripe.products.list({ limit: 1 });
  if (process.env.NODE_ENV !== 'production' && sample.data.some(p => p.livemode)) {
    throw new Error('Development requires the Stripe sandbox, not live credentials.');
  }
  await runMigrations({ databaseUrl: process.env.DATABASE_URL });
  sync = new StripeSync({
    // Stable, account-scoped non-secret identity for the connector transport.
    stripeSecretKey: `connector:${account.id}`,
    stripeAccountId: account.id,
    poolConfig: { connectionString: process.env.DATABASE_URL, max: 3 },
  });
  // Public SDK property: all sync operations use the same authenticated proxy.
  sync.stripe = stripe;
  await sync.syncBackfill({ object: 'product' });
  await sync.syncBackfill({ object: 'price' });
  await pool.query(`CREATE TABLE IF NOT EXISTS public.checkout_requests (
    id text PRIMARY KEY, cart_hash text NOT NULL, session_id text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Dev previews are private and not reliable webhook destinations.
  // Register the public production URL only when the payment backend is published.
  return account;
}
export async function initializeProductionWebhooks() {
  if (process.env.NODE_ENV !== 'production') return;
  await sync.findOrCreateManagedWebhook('https://docobuild.replit.app/api/stripe/webhook');
  await sync.syncBackfill({ object: 'all' });
}
export function getStripeSync() {
  if (!sync) throw new Error('Stripe sync is not initialized');
  return sync;
}
