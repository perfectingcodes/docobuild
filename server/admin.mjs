import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { ADMIN_COOKIE, passwordMatches, issueToken, verifyToken, parseCookies, cookieHeader } from './admin-auth.mjs';
import { cleanEvent, buildSeries, summarizeOrders, liveCarts, sessionToOrder, ordersCsv } from './analytics-aggregate.mjs';
import { CATALOG } from './catalog.mjs';

export async function ensureAdminTables(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.site_events (
    id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), type text NOT NULL, sid text NOT NULL,
    path text, ref text, device text, meta jsonb NOT NULL DEFAULT '{}'::jsonb)`);
  await pool.query('CREATE INDEX IF NOT EXISTS site_events_ts_idx ON public.site_events (ts)');
  await pool.query('CREATE INDEX IF NOT EXISTS site_events_type_ts_idx ON public.site_events (type, ts)');
  await pool.query(`CREATE TABLE IF NOT EXISTS public.creator_applications (
    id uuid PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), name text NOT NULL, email text NOT NULL,
    handle text, platform text, audience text, website text, message text, status text NOT NULL DEFAULT 'new')`);
  await pool.query(`CREATE TABLE IF NOT EXISTS public.email_signups (
    id uuid PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), email text NOT NULL UNIQUE, source text, code text)`);
}
export const WELCOME_CODE = process.env.WELCOME_CODE || 'LETSGO10';

function production() { return process.env.NODE_ENV === 'production'; }
function isAdmin(req) { return verifyToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]); }
function requireAdmin(req, res, next) { if (isAdmin(req)) return next(); res.status(401).json({ error: 'Sign in required.' }); }

export function registerAdmin(app, { pool, stripe }) {
  const cache = new Map();
  async function cached(key, ttlMs, fn) {
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    const value = await fn(); cache.set(key, { value, until: Date.now() + ttlMs }); return value;
  }
  async function paidSessions(days) {
    return cached(`sessions:${days}`, 60000, async () => {
      const since = Math.floor(Date.now() / 1000) - days * 86400;
      const sessions = await stripe.checkout.sessions.list({ limit: 100, created: { gte: since }, expand: ['data.line_items'] }).autoPagingToArray({ limit: 1000 });
      return sessions.filter(s => s.metadata?.doco_checkout === 'true' && s.payment_status === 'paid' && s.livemode === production()).map(sessionToOrder);
    });
  }

  /* ---- public: event tracking (no personal data) ---- */
  app.post('/api/track', rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
    const ev = cleanEvent(req.body);
    if (!ev) return res.status(204).end();
    try { await pool.query('INSERT INTO public.site_events(type,sid,path,ref,device,meta) VALUES($1,$2,$3,$4,$5,$6)', [ev.type, ev.sid, ev.path, ev.ref, ev.device, ev.meta]); }
    catch (error) { console.error('track failed:', error.code || error.name); }
    res.status(204).end();
  });

  /* ---- public: creator applications ---- */
  app.post('/api/creators', rateLimit({ windowMs: 3600000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res, next) => {
    const b = req.body || {};
    const str = (v, max) => String(v ?? '').trim().slice(0, max);
    const name = str(b.name, 80), email = str(b.email, 120), handle = str(b.handle, 80), platform = str(b.platform, 40), audience = str(b.audience, 40), website = str(b.website, 160), message = str(b.message, 1500);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Please add your name and a valid email.' });
    try {
      const id = randomUUID();
      await pool.query('INSERT INTO public.creator_applications(id,name,email,handle,platform,audience,website,message) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, name, email, handle, platform, audience, website, message]);
      res.json({ ok: true, id });
    } catch (error) { next(error); }
  });

  /* ---- public: email signups (welcome offer) ---- */
  app.post('/api/subscribe', rateLimit({ windowMs: 3600000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res, next) => {
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 120), source = String(req.body?.source || 'popup').slice(0, 40);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
    try {
      await pool.query('INSERT INTO public.email_signups(id,email,source,code) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING', [randomUUID(), email, source, WELCOME_CODE]);
      res.json({ ok: true, code: WELCOME_CODE });
    } catch (error) { next(error); }
  });

  /* ---- admin auth ---- */
  app.post('/api/admin/login', rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }), (req, res) => {
    if (!passwordMatches(req.body?.password)) return res.status(401).json({ error: 'Wrong password.' });
    res.set('Set-Cookie', cookieHeader(issueToken(), { secure: production() }));
    res.json({ ok: true });
  });
  app.post('/api/admin/logout', (_req, res) => { res.set('Set-Cookie', cookieHeader('', { secure: production(), maxAgeSeconds: 0 })); res.json({ ok: true }); });
  app.get('/api/admin/session', (req, res) => res.status(isAdmin(req) ? 200 : 401).json({ ok: isAdmin(req), testMode: !production() }));

  /* ---- admin data ---- */
  const days = req => Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
  app.get('/api/admin/overview', requireAdmin, async (req, res, next) => {
    try {
      const d = days(req), since = new Date(Date.now() - d * 86400000);
      const orders = await paidSessions(d);
      const [visitors, counts, subs] = await Promise.all([
        pool.query(`SELECT to_char(ts AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, COUNT(DISTINCT sid) AS visitors, COUNT(*) FILTER (WHERE type='pageview') AS pageviews
                    FROM public.site_events WHERE ts >= $1 AND type='pageview' GROUP BY 1`, [since]),
        pool.query(`SELECT type, COUNT(*) AS n, COUNT(DISTINCT sid) AS sessions FROM public.site_events WHERE ts >= $1 GROUP BY type`, [since]),
        cached('subs:active', 60000, async () => (await stripe.subscriptions.list({ status: 'active', limit: 100 }).autoPagingToArray({ limit: 1000 })).filter(s => s.livemode === production()).length),
      ]);
      const by = Object.fromEntries(counts.rows.map(r => [r.type, { n: Number(r.n), sessions: Number(r.sessions) }]));
      const visitorsTotal = (await pool.query('SELECT COUNT(DISTINCT sid) AS n FROM public.site_events WHERE ts >= $1', [since])).rows[0].n;
      const emailSignups = Number((await pool.query('SELECT COUNT(*) AS n FROM public.email_signups WHERE ts >= $1', [since])).rows[0].n);
      const sum = summarizeOrders(orders);
      res.json({
        days: d, testMode: !production(), ...sum, subscriptionsActive: subs,
        visitors: Number(visitorsTotal), pageviews: by.pageview?.n || 0,
        emailSignups, addToCart: by.add_to_cart?.sessions || 0, checkoutStarts: by.checkout_start?.sessions || 0, quizzes: by.quiz_complete?.n || 0,
        conversion: Number(visitorsTotal) ? +(100 * orders.length / Number(visitorsTotal)).toFixed(2) : 0,
        series: buildSeries(Math.min(d, 90), orders, visitors.rows),
      });
    } catch (error) { next(error); }
  });
  app.get('/api/admin/orders', requireAdmin, async (req, res, next) => {
    try { const orders = await paidSessions(days(req)); res.json({ orders: orders.sort((a, b) => b.created - a.created) }); } catch (error) { next(error); }
  });
  app.get('/api/admin/orders.csv', requireAdmin, async (req, res, next) => {
    try { const orders = await paidSessions(days(req)); res.set('Content-Type', 'text/csv'); res.set('Content-Disposition', 'attachment; filename="doco-orders.csv"'); res.send(ordersCsv(orders)); } catch (error) { next(error); }
  });
  app.get('/api/admin/subscriptions', requireAdmin, async (_req, res, next) => {
    try {
      const subs = await cached('subs:list', 60000, async () => (await stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer'] }).autoPagingToArray({ limit: 1000 })).filter(s => s.livemode === production()));
      res.json({ subscriptions: subs.map(s => ({ id: s.id, status: s.status, created: s.created, currentPeriodEnd: s.current_period_end, cancelAtPeriodEnd: !!s.cancel_at_period_end,
        email: s.customer?.email || '', name: s.customer?.name || '', amount: (s.items?.data || []).reduce((t, i) => t + (i.price?.unit_amount || 0) * (i.quantity || 1), 0),
        items: (s.items?.data || []).map(i => ({ name: i.price?.nickname || i.price?.product?.name || i.price?.product || 'Plan', qty: i.quantity || 1 })) })) });
    } catch (error) { next(error); }
  });
  app.get('/api/admin/carts', requireAdmin, async (_req, res, next) => {
    try {
      const rows = (await pool.query(`SELECT DISTINCT ON (sid) sid, meta, ts FROM public.site_events WHERE type='cart_update' AND ts >= now() - interval '7 days' ORDER BY sid, ts DESC`)).rows;
      const checkedOut = new Set((await pool.query(`SELECT DISTINCT sid FROM public.site_events WHERE type='checkout_start' AND ts >= now() - interval '7 days'`)).rows.map(r => r.sid));
      const open = rows.filter(r => !checkedOut.has(r.sid));
      res.json({ ...liveCarts(open, CATALOG), abandonedAfterCheckout: rows.length - open.length, catalog: Object.fromEntries(Object.entries(CATALOG).map(([k, v]) => [k, v.name])) });
    } catch (error) { next(error); }
  });
  app.get('/api/admin/analytics', requireAdmin, async (req, res, next) => {
    try {
      const since = new Date(Date.now() - days(req) * 86400000);
      const q = (sql) => pool.query(sql, [since]).then(r => r.rows);
      const [pages, refs, devices, quiz, products] = await Promise.all([
        q(`SELECT path, COUNT(*) AS views, COUNT(DISTINCT sid) AS visitors FROM public.site_events WHERE ts>=$1 AND type='pageview' GROUP BY path ORDER BY views DESC LIMIT 12`),
        q(`SELECT COALESCE(NULLIF(ref,''),'direct') AS ref, COUNT(DISTINCT sid) AS visitors FROM public.site_events WHERE ts>=$1 AND type='pageview' GROUP BY 1 ORDER BY visitors DESC LIMIT 10`),
        q(`SELECT device, COUNT(DISTINCT sid) AS visitors FROM public.site_events WHERE ts>=$1 AND type='pageview' GROUP BY device`),
        q(`SELECT meta->>'sku' AS sku, COUNT(*) AS n FROM public.site_events WHERE ts>=$1 AND type='quiz_complete' GROUP BY 1 ORDER BY n DESC`),
        q(`SELECT meta->>'sku' AS sku, COUNT(*) AS n FROM public.site_events WHERE ts>=$1 AND type='add_to_cart' GROUP BY 1 ORDER BY n DESC`),
      ]);
      res.json({ pages, referrers: refs, devices, quiz, addToCartBySku: products, catalog: Object.fromEntries(Object.entries(CATALOG).map(([k, v]) => [k, v.name])) });
    } catch (error) { next(error); }
  });
  app.get('/api/admin/emails', requireAdmin, async (_req, res, next) => {
    try { res.json({ code: WELCOME_CODE, emails: (await pool.query('SELECT id, ts, email, source, code FROM public.email_signups ORDER BY ts DESC LIMIT 2000')).rows }); } catch (error) { next(error); }
  });
  app.get('/api/admin/emails.csv', requireAdmin, async (_req, res, next) => {
    try {
      const rows = (await pool.query('SELECT ts, email, source, code FROM public.email_signups ORDER BY ts DESC')).rows;
      res.set('Content-Type', 'text/csv'); res.set('Content-Disposition', 'attachment; filename="doco-emails.csv"');
      res.send(['date,email,source,code', ...rows.map(r => [new Date(r.ts).toISOString(), r.email, r.source, r.code].map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))].join('\n'));
    } catch (error) { next(error); }
  });
  app.get('/api/admin/creators', requireAdmin, async (_req, res, next) => {
    try { res.json({ applications: (await pool.query('SELECT id, ts, name, email, handle, platform, audience, website, message, status FROM public.creator_applications ORDER BY ts DESC LIMIT 500')).rows }); } catch (error) { next(error); }
  });
  app.post('/api/admin/creators/:id', requireAdmin, express.json(), async (req, res, next) => {
    const status = ['new', 'contacted', 'approved', 'declined'].includes(req.body?.status) ? req.body.status : null;
    if (!status || !/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid update.' });
    try { await pool.query('UPDATE public.creator_applications SET status=$1 WHERE id=$2', [status, req.params.id]); res.json({ ok: true }); } catch (error) { next(error); }
  });
}
