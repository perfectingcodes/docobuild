import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripe, pool, account, getStripeSync } from './stripe.mjs';
import { listCheckoutPrices } from './storage.mjs';
import { normalizeCart } from './catalog.mjs';
import { buildCheckout } from './checkout.mjs';
import { catalogReadiness, portalReady } from './readiness.mjs';
import { registerAdmin } from './admin.mjs';
import { checkoutOrigin } from './checkout-origin.mjs';
import { cleanUrls } from './clean-urls.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  // Preserve the imported inline styling; card collection is hosted by Stripe.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"],
      formAction: ["'self'"], frameAncestors: ["'self'", 'https://*.replit.dev', 'https://replit.com'],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: false,
}));
app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  if (!req.headers['stripe-signature']) return res.status(400).json({ error: 'Missing signature' });
  try {
    await getStripeSync().processWebhook(req.body, req.headers['stripe-signature']);
    res.json({ received: true });
  } catch {
    res.status(400).json({ error: 'Webhook signature or processing failed' });
  }
});
app.use('/api', rateLimit({ windowMs: 60000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function approvedOrigin(req) {
  return checkoutOrigin(req.get('origin'), {
    production: process.env.NODE_ENV === 'production',
    devDomain: process.env.REPLIT_DEV_DOMAIN,
  });
}
function proof(requestId) {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');
  return createHmac('sha256', process.env.SESSION_SECRET).update(requestId).digest('hex');
}
app.get('/api/commerce', async (_req, res, next) => {
  try {
    const prices = await listCheckoutPrices();
    const production = process.env.NODE_ENV === 'production';
    const complete = catalogReadiness(prices, { production }).ready;
    const portals = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    const portal = portals.data.find(p => p.metadata?.doco_portal === 'true');
    res.json({
      enabled: complete && portalReady(portal) && (!production || account.charges_enabled),
      testMode: !production,
      portalUrl: portal?.login_page?.url || null,
    });
  } catch (error) { next(error); }
});
app.post('/api/create-checkout-session', async (req, res, next) => {
  const origin = approvedOrigin(req);
  if (!origin) return res.status(403).json({ error: 'Unrecognized checkout origin.' });
  let cart;
  try { cart = normalizeCart(req.body?.items); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const requestId = req.get('Idempotency-Key') || randomUUID();
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) return res.status(400).json({ error: 'Invalid checkout request.' });
  try {
    const prices = await listCheckoutPrices();
    if (!catalogReadiness(prices, { production: process.env.NODE_ENV === 'production' }).ready) {
      return res.status(503).json({ error: 'The payment catalog is not ready. Please contact DOCO.' });
    }
    const cartHash = createHash('sha256').update(JSON.stringify({ origin, cart })).digest('hex');
    await pool.query(
      'INSERT INTO public.checkout_requests(id,cart_hash) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
      [requestId, cartHash]);
    const previous = (await pool.query('SELECT cart_hash,session_id FROM public.checkout_requests WHERE id=$1',
      [requestId])).rows[0];
    if (previous.cart_hash !== cartHash) return res.status(409).json({ error: 'Your bag changed. Please retry checkout.' });
    if (previous.session_id) {
      const old = await stripe.checkout.sessions.retrieve(previous.session_id);
      if (old.status === 'open' && old.url) return res.json({ url: old.url });
      return res.status(409).json({ error: 'That checkout has finished or expired. Start a new checkout.' });
    }
    const params = buildCheckout(cart, prices, {
      successUrl: `${origin}/thanks.html?session_id={CHECKOUT_SESSION_ID}&proof=${proof(requestId)}`,
      cancelUrl: `${origin}/shop.html?checkout=canceled`,
      requestId,
    });
    const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `doco-${requestId}` });
    await pool.query('UPDATE public.checkout_requests SET session_id=$1 WHERE id=$2', [session.id, requestId]);
    res.json({ url: session.url });
  } catch (error) { next(error); }
});
app.get('/api/checkout-status', async (req, res, next) => {
  const { session_id: id, proof: supplied } = req.query;
  if (typeof id !== 'string' || !/^cs_(test_|live_)?[a-zA-Z0-9_]{10,220}$/.test(id) ||
      typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied)) {
    return res.status(400).json({ error: 'A valid checkout confirmation link is required.' });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    const requestId = session.metadata?.checkout_request_id;
    if (!requestId || session.metadata?.doco_checkout !== 'true' ||
        !timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(proof(requestId), 'hex'))) {
      return res.status(404).json({ error: 'Checkout confirmation not found.' });
    }
    const paid = session.status === 'complete' && session.payment_status === 'paid';
    res.json({ paid, status: session.status, testMode: !session.livemode, reference: paid ? session.id.slice(-8) : null });
  } catch (error) { next(error); }
});
registerAdmin(app, { pool, stripe });
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(cleanUrls);
app.use(express.static(root, { dotfiles: 'deny', etag: true, extensions: ['html'], setHeaders(res, file) {
  if (/\.(html|js|css)$/.test(file)) res.set('Cache-Control', 'no-cache');
} }));
app.use((error, _req, res, _next) => {
  // Do not log Stripe request bodies, customer details, or credential responses.
  console.error('Request failed:', error.type || error.code || error.name);
  const badInput = error.type === 'entity.parse.failed';
  res.status(badInput ? 400 : 503).json({
    error: badInput ? 'Invalid request body.' : 'Checkout is temporarily unavailable. Please try again or contact DOCO.',
  });
});
