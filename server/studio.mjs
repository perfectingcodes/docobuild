// Admin studio: design links, social schedule, email automations (Resend). Additive only — no checkout code is touched.
import express from 'express';
import { randomUUID } from 'node:crypto';
import { ADMIN_COOKIE, verifyToken, parseCookies } from './admin-auth.mjs';
import { sessionToOrder } from './analytics-aggregate.mjs';
import { resendConnected, resendSend } from './mailer.mjs';
import { EMAIL_KINDS, DEFAULT_TEMPLATES, DEFAULT_SETTINGS, SAMPLE_VARS, PLATFORMS, POST_STATUSES, renderEmail, orderVars, ownerOrderVars, money, validateTemplate, validateSocialPost, validateSettings, validEmail } from './studio-lib.mjs';

export async function ensureStudioTables(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.admin_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS public.social_posts (
    id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), scheduled_at timestamptz NOT NULL, platform text NOT NULL, title text NOT NULL,
    caption text, link text, notes text, status text NOT NULL DEFAULT 'planned', posted_at timestamptz)`);
  await pool.query('CREATE INDEX IF NOT EXISTS social_posts_sched_idx ON public.social_posts (scheduled_at)');
  await pool.query(`CREATE TABLE IF NOT EXISTS public.email_templates (kind text PRIMARY KEY, subject text NOT NULL, body text NOT NULL, enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS public.email_log (
    id uuid PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), kind text NOT NULL, to_email text NOT NULL, subject text, status text NOT NULL, ref text, provider_id text, error text)`);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS email_log_kind_ref_idx ON public.email_log (kind, ref) WHERE ref IS NOT NULL AND status IN (\'sent\')');
  await pool.query('CREATE INDEX IF NOT EXISTS email_log_ts_idx ON public.email_log (ts)');
}

function production() { return process.env.NODE_ENV === 'production'; }
function isAdmin(req) { return verifyToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]); }
function requireAdmin(req, res, next) { if (isAdmin(req)) return next(); res.status(401).json({ error: 'Sign in required.' }); }

export function createStudio({ pool, stripe, sendEmail = resendSend, mailConnected = resendConnected }) {
  let settingsCache = null, templatesCache = null;
  async function getSettings() {
    if (settingsCache && settingsCache.until > Date.now()) return settingsCache.value;
    const row = (await pool.query("SELECT value FROM public.admin_settings WHERE key='studio'")).rows[0];
    const value = validateSettings(row?.value || {}, DEFAULT_SETTINGS);
    settingsCache = { value, until: Date.now() + 30000 }; return value;
  }
  async function saveSettings(value) {
    await pool.query("INSERT INTO public.admin_settings(key,value,updated_at) VALUES('studio',$1,now()) ON CONFLICT(key) DO UPDATE SET value=$1, updated_at=now()", [value]);
    settingsCache = null;
  }
  async function getTemplates() {
    if (templatesCache && templatesCache.until > Date.now()) return templatesCache.value;
    const rows = (await pool.query('SELECT kind, subject, body, enabled, updated_at FROM public.email_templates')).rows;
    const value = Object.fromEntries(Object.keys(EMAIL_KINDS).map(k => { const r = rows.find(x => x.kind === k); return [k, r ? { subject: r.subject, body: r.body, enabled: r.enabled, updatedAt: r.updated_at, custom: true } : { ...DEFAULT_TEMPLATES[k], custom: false }]; }));
    templatesCache = { value, until: Date.now() + 30000 }; return value;
  }
  function senderFrom(s) { return s.email.fromEmail ? `${s.email.fromName || 'DOCO'} <${s.email.fromEmail}>` : null; }
  async function log(entry) {
    try { await pool.query('INSERT INTO public.email_log(id,kind,to_email,subject,status,ref,provider_id,error) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING', [randomUUID(), entry.kind, entry.to, entry.subject || '', entry.status, entry.ref || null, entry.providerId || null, entry.error ? String(entry.error).slice(0, 400) : null]); }
    catch (error) { console.error('email log failed:', error.code || error.name); }
  }

  /** Send one automation email. Never throws; returns a status string. */
  async function notify(kind, vars, { to, ref } = {}) {
    try {
      if (!EMAIL_KINDS[kind] || !validEmail(to)) return 'skipped';
      const [settings, templates] = await Promise.all([getSettings(), getTemplates()]);
      const tpl = templates[kind];
      if (!tpl.enabled) return 'disabled';
      if (!mailConnected() || !senderFrom(settings)) { await log({ kind, to, status: 'skipped', ref, error: mailConnected() ? 'No sender address set' : 'Resend not connected' }); return 'not-connected'; }
      if (ref) { const dup = (await pool.query("SELECT 1 FROM public.email_log WHERE kind=$1 AND ref=$2 AND status='sent' LIMIT 1", [kind, ref])).rows[0]; if (dup) return 'duplicate'; }
      const mail = renderEmail(tpl, vars);
      const providerId = await sendEmail({ from: senderFrom(settings), to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: settings.email.replyTo || undefined,
        ...(kind === 'owner_order' && ref ? { idempotencyKey: `doco-owner-order-${ref}` } : {}) });
      await log({ kind, to, subject: mail.subject, status: 'sent', ref, providerId });
      return 'sent';
    } catch (error) {
      await log({ kind, to: to || '', status: 'failed', ref, error: error.message });
      console.error('email failed:', kind, error.message);
      return 'failed';
    }
  }

  /** Called with an already signature-verified Stripe event. Fire-and-forget. */
  async function onStripeEvent(event) {
    try {
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event?.type)) return;
      const obj = event.data?.object; if (!obj || obj.metadata?.doco_checkout !== 'true' || obj.payment_status !== 'paid') return;
      if (!!obj.livemode !== production()) return;
      const session = await stripe.checkout.sessions.retrieve(obj.id, { expand: ['line_items'] });
      if (session.status !== 'complete' || session.payment_status !== 'paid' ||
          session.metadata?.doco_checkout !== 'true' || !!session.livemode !== production()) return;
      if (session.line_items?.has_more) {
        session.line_items = { data: await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 }).autoPagingToArray({ limit: 100 }) };
      }
      const order = sessionToOrder(session);
      await notify('order_confirmation', orderVars(order), { to: order.email, ref: session.id });
      await notify('owner_order', ownerOrderVars(session, order), { to: 'joyce@docostrips.com', ref: session.id });
    } catch (error) { console.error('order email hook failed:', error.message); }
  }

  async function runReminders() {
    const out = { renewal: 0, reorder: 0, checked: 0 };
    try {
      const s = await getSettings();
      const subs = (await stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.customer'] }).autoPagingToArray({ limit: 1000 })).filter(x => x.livemode === production());
      const now = Math.floor(Date.now() / 1000), horizon = now + s.reminders.renewalDays * 86400;
      for (const sub of subs) {
        out.checked++;
        if (sub.cancel_at_period_end || !sub.current_period_end || sub.current_period_end < now || sub.current_period_end > horizon) continue;
        const email = sub.customer?.email; if (!validEmail(email)) continue;
        const items = (sub.items?.data || []).map(i => `${i.quantity || 1} × ${i.price?.nickname || 'DOCO strips'}`).join('\n');
        const amount = money((sub.items?.data || []).reduce((t, i) => t + (i.price?.unit_amount || 0) * (i.quantity || 1), 0));
        const r = await notify('renewal_reminder', { name: (sub.customer?.name || '').split(' ')[0] || 'there', items, amount, renews_on: new Date(sub.current_period_end * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }, { to: email, ref: `${sub.id}:${sub.current_period_end}` });
        if (r === 'sent') out.renewal++;
      }
      const d = s.reminders.reorderDays, gte = now - (d + 10) * 86400, lte = now - d * 86400;
      const sessions = await stripe.checkout.sessions.list({ limit: 100, created: { gte, lte }, expand: ['data.line_items'] }).autoPagingToArray({ limit: 500 });
      for (const sess of sessions) {
        if (sess.metadata?.doco_checkout !== 'true' || sess.payment_status !== 'paid' || sess.mode === 'subscription' || sess.livemode !== production()) continue;
        out.checked++;
        const order = sessionToOrder(sess);
        const r = await notify('reorder', orderVars(order), { to: order.email, ref: sess.id });
        if (r === 'sent') out.reorder++;
      }
    } catch (error) { console.error('reminder sweep failed:', error.message); out.error = error.message; }
    return out;
  }

  function register(app) {
    const json = express.json({ limit: '64kb' });
    /* ---- settings (design links + sender + reminder timing) ---- */
    app.get('/api/admin/settings', requireAdmin, async (_req, res, next) => {
      try { res.json({ settings: await getSettings(), resendConnected: resendConnected(), testMode: !production() }); } catch (error) { next(error); }
    });
    app.post('/api/admin/settings', requireAdmin, json, async (req, res, next) => {
      try { const next_ = validateSettings(req.body || {}, await getSettings()); await saveSettings(next_); res.json({ ok: true, settings: next_ }); }
      catch (error) { if (/must|valid/i.test(error.message)) return res.status(400).json({ error: error.message }); next(error); }
    });

    /* ---- social schedule ---- */
    app.get('/api/admin/social', requireAdmin, async (_req, res, next) => {
      try {
        const rows = (await pool.query('SELECT id, created_at, scheduled_at, platform, title, caption, link, notes, status, posted_at FROM public.social_posts ORDER BY scheduled_at ASC LIMIT 1000')).rows;
        res.json({ posts: rows.map(r => ({ id: r.id, createdAt: r.created_at, scheduledAt: r.scheduled_at, platform: r.platform, title: r.title, caption: r.caption, link: r.link, notes: r.notes, status: r.status, postedAt: r.posted_at })), platforms: PLATFORMS, statuses: POST_STATUSES });
      } catch (error) { next(error); }
    });
    app.post('/api/admin/social', requireAdmin, json, async (req, res, next) => {
      try {
        const p = validateSocialPost(req.body || {}); const id = randomUUID();
        await pool.query('INSERT INTO public.social_posts(id,scheduled_at,platform,title,caption,link,notes,status,posted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, p.scheduledAt, p.platform, p.title, p.caption, p.link, p.notes, p.status, p.status === 'posted' ? new Date() : null]);
        res.json({ ok: true, id });
      } catch (error) { if (/Pick|Give|Links/.test(error.message)) return res.status(400).json({ error: error.message }); next(error); }
    });
    app.post('/api/admin/social/:id', requireAdmin, json, async (req, res, next) => {
      if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid post.' });
      try {
        if (req.body && Object.keys(req.body).length === 1 && req.body.status) {
          const status = POST_STATUSES.includes(req.body.status) ? req.body.status : 'planned';
          await pool.query('UPDATE public.social_posts SET status=$1, posted_at=CASE WHEN $1=\'posted\' THEN now() ELSE posted_at END WHERE id=$2', [status, req.params.id]);
          return res.json({ ok: true });
        }
        const p = validateSocialPost(req.body || {});
        await pool.query('UPDATE public.social_posts SET scheduled_at=$1, platform=$2, title=$3, caption=$4, link=$5, notes=$6, status=$7, posted_at=CASE WHEN $7=\'posted\' AND posted_at IS NULL THEN now() ELSE posted_at END WHERE id=$8', [p.scheduledAt, p.platform, p.title, p.caption, p.link, p.notes, p.status, req.params.id]);
        res.json({ ok: true });
      } catch (error) { if (/Pick|Give|Links/.test(error.message)) return res.status(400).json({ error: error.message }); next(error); }
    });
    app.delete('/api/admin/social/:id', requireAdmin, async (req, res, next) => {
      if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid post.' });
      try { await pool.query('DELETE FROM public.social_posts WHERE id=$1', [req.params.id]); res.json({ ok: true }); } catch (error) { next(error); }
    });

    /* ---- email portal ---- */
    app.get('/api/admin/email', requireAdmin, async (_req, res, next) => {
      try {
        const [settings, templates, logRows, counts] = await Promise.all([getSettings(), getTemplates(),
          pool.query('SELECT id, ts, kind, to_email, subject, status, ref, error FROM public.email_log ORDER BY ts DESC LIMIT 200'),
          pool.query("SELECT status, COUNT(*) AS n FROM public.email_log WHERE ts >= now() - interval '30 days' GROUP BY status")]);
        res.json({ connected: resendConnected(), sender: senderFrom(settings), settings, kinds: EMAIL_KINDS, templates, sample: SAMPLE_VARS,
          log: logRows.rows.map(r => ({ id: r.id, ts: r.ts, kind: r.kind, to: r.to_email, subject: r.subject, status: r.status, ref: r.ref, error: r.error })),
          counts: Object.fromEntries(counts.rows.map(r => [r.status, Number(r.n)])) });
      } catch (error) { next(error); }
    });
    app.post('/api/admin/email/templates/:kind', requireAdmin, json, async (req, res, next) => {
      const kind = req.params.kind; if (!EMAIL_KINDS[kind]) return res.status(400).json({ error: 'Unknown email.' });
      try {
        if (req.body?.reset) { await pool.query('DELETE FROM public.email_templates WHERE kind=$1', [kind]); templatesCache = null; return res.json({ ok: true, template: DEFAULT_TEMPLATES[kind] }); }
        const current = (await getTemplates())[kind];
        const t = validateTemplate({ subject: req.body?.subject ?? current.subject, body: req.body?.body ?? current.body, enabled: req.body?.enabled ?? current.enabled });
        await pool.query('INSERT INTO public.email_templates(kind,subject,body,enabled,updated_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(kind) DO UPDATE SET subject=$2, body=$3, enabled=$4, updated_at=now()', [kind, t.subject, t.body, t.enabled]);
        templatesCache = null; res.json({ ok: true, template: t });
      } catch (error) { if (/too short/.test(error.message)) return res.status(400).json({ error: error.message }); next(error); }
    });
    app.post('/api/admin/email/preview', requireAdmin, json, (req, res) => {
      try { const t = validateTemplate(req.body || {}); res.json(renderEmail(t, SAMPLE_VARS)); } catch (error) { res.status(400).json({ error: error.message }); }
    });
    app.post('/api/admin/email/test', requireAdmin, json, async (req, res, next) => {
      const kind = req.body?.kind, to = String(req.body?.to || '').trim().toLowerCase();
      if (!EMAIL_KINDS[kind] || !validEmail(to)) return res.status(400).json({ error: 'Pick an email type and a valid address.' });
      try {
        const settings = await getSettings();
        if (!resendConnected()) return res.status(400).json({ error: 'Resend is not connected yet. Connect Resend in Integrations and restart the app.' });
        if (!senderFrom(settings)) return res.status(400).json({ error: 'Set a From email first (a verified Resend domain).' });
        const tpl = req.body?.subject && req.body?.body ? validateTemplate(req.body) : (await getTemplates())[kind];
        const mail = renderEmail(tpl, SAMPLE_VARS);
        const providerId = await resendSend({ from: senderFrom(settings), to, subject: '[Test] ' + mail.subject, html: mail.html, text: mail.text, replyTo: settings.email.replyTo || undefined });
        await log({ kind, to, subject: '[Test] ' + mail.subject, status: 'test', providerId });
        res.json({ ok: true });
      } catch (error) { await log({ kind, to, status: 'failed', error: error.message }); res.status(502).json({ error: error.message }); }
    });
    app.post('/api/admin/email/run-reminders', requireAdmin, async (_req, res) => { res.json(await runReminders()); });
  }

  function startSweeps() {
    if (!production()) return;
    const tick = () => runReminders().catch(() => {});
    setTimeout(tick, 90000); setInterval(tick, 6 * 3600000).unref?.();
  }

  return { register, notify, onStripeEvent, runReminders, startSweeps };
}
