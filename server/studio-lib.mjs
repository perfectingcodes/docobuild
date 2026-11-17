// Pure helpers for the admin "studio" (design links, social schedule, email automations). No I/O here.
const SITE = 'https://docostrips.com';

export const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X', 'Pinterest', 'Email', 'Other'];
export const POST_STATUSES = ['idea', 'planned', 'scheduled', 'posted', 'skipped'];

export const EMAIL_KINDS = {
  owner_order: { name: 'New paid order — owner notification', trigger: 'Sent to joyce@docostrips.com when a DOCO checkout is paid.', vars: ['customer_name', 'customer_email', 'reference', 'items', 'total', 'ship_to', 'mode'] },
  order_confirmation: { name: 'Order confirmation', trigger: 'Sent the moment a Stripe checkout is paid.', vars: ['name', 'reference', 'items', 'total', 'ship_to', 'mode'] },
  welcome: { name: 'Welcome offer', trigger: 'Sent when someone enters their email in the welcome popup.', vars: ['code'] },
  creator_received: { name: 'Creator application received', trigger: 'Sent when a creator submits the application form.', vars: ['name'] },
  creator_approved: { name: 'Creator approved', trigger: 'Sent when you mark a creator application as approved.', vars: ['name', 'handle'] },
  renewal_reminder: { name: 'Subscription renewal reminder', trigger: 'Sent a few days before a subscription renews (checked every few hours).', vars: ['name', 'items', 'renews_on', 'amount'] },
  reorder: { name: 'Time to restock', trigger: 'Sent to one-time buyers about three weeks after their order.', vars: ['name', 'items', 'reference'] },
};

export const DEFAULT_TEMPLATES = {
  owner_order: { enabled: true, subject: 'New paid DOCO order — #{{reference}}',
    body: 'A new DOCO order has been paid.\n\n**Order #{{reference}}**\nPurchase type: {{mode}}\nCustomer: {{customer_name}}\nCustomer email: {{customer_email}}\n\n{{items}}\n\n**Order total: {{total}}**\n\nShipping to:\n{{ship_to}}\n\nReview the order in your DOCO admin or Stripe before fulfillment.' },
  order_confirmation: { enabled: true, subject: 'Your DOCO order is in — #{{reference}}',
    body: 'Hi {{name}},\n\nThanks for doing more with us. Your order is confirmed and we are getting it ready.\n\n**Order #{{reference}}**\n{{items}}\nTotal: {{total}}\n\nShipping to:\n{{ship_to}}\n\nYou will get another note when it ships. Questions? Just reply to this email.\n\nDo more. Be more.\nThe DOCO team' },
  welcome: { enabled: true, subject: 'Your 10% off code is inside',
    body: 'Welcome to DOCO.\n\nHere is your code for 10% off your first order:\n\n**{{code}}**\n\nEnter it at checkout. Four clean formulas, dissolves on your tongue in seconds, no water needed.\n\nShop the formulas: ' + SITE + '/shop\n\nDo more. Be more.' },
  creator_received: { enabled: true, subject: 'We got your DOCO creator application',
    body: 'Hi {{name}},\n\nThanks for applying to partner with DOCO. We read every application and reply within a few days.\n\nIn the meantime, find your formula: ' + SITE + '/\n\nTalk soon,\nThe DOCO team' },
  creator_approved: { enabled: true, subject: 'You are in — welcome to the DOCO creator program',
    body: 'Hi {{name}},\n\nGood news: you are approved. We will follow up shortly with your personal code, tracked link and your first box.\n\nQuestions in the meantime? Reply to this email.\n\nDo more. Be more.\nThe DOCO team' },
  renewal_reminder: { enabled: true, subject: 'Your DOCO strips renew on {{renews_on}}',
    body: 'Hi {{name}},\n\nA quick heads-up: your subscription renews on {{renews_on}} for {{amount}}.\n\n{{items}}\n\nWant to change or pause it? Reply to this email and we will sort it out.\n\nDo more. Be more.\nThe DOCO team' },
  reorder: { enabled: true, subject: 'Running low? Restock your DOCO strips',
    body: 'Hi {{name}},\n\nIt has been about three weeks since your order #{{reference}}, so your box is probably getting light.\n\n{{items}}\n\nRestock here: ' + SITE + '/shop\nOr subscribe and save 15% every month.\n\nDo more. Be more.\nThe DOCO team\n\nReply to this email if you would rather not get restock reminders.' },
};

export const DEFAULT_SETTINGS = {
  driveUrl: '', designLinks: [],
  email: { fromName: 'DOCO', fromEmail: '', replyTo: 'joyce@docostrips.com' },
  reminders: { renewalDays: 3, reorderDays: 24 },
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function money(cents) { return '$' + (Number(cents || 0) / 100).toFixed(2); }

export function fillVars(text, vars) {
  return String(text ?? '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) => (vars && vars[k] != null ? String(vars[k]) : ''));
}

/** Turns the plain-text template (with **bold** and blank-line paragraphs) into safe HTML. */
export function textToHtml(text) {
  const paras = String(text).split(/\n{2,}/).map(p => p.split('\n').map(line => {
    let h = esc(line);
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#ec8229;font-weight:700">$1</a>');
    return h;
  }).join('<br>'));
  return paras.map(p => '<p style="margin:0 0 16px;line-height:1.6">' + p + '</p>').join('');
}

export function wrapHtml(innerHtml, { preheader = '' } = {}) {
  return '<!doctype html><html><body style="margin:0;padding:0;background:#f3f3f1;font-family:Inter,Helvetica,Arial,sans-serif;color:#111">' +
    (preheader ? '<div style="display:none;max-height:0;overflow:hidden">' + esc(preheader) + '</div>' : '') +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f3f1"><tr><td align="center" style="padding:28px 14px">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e6e6e2">' +
    '<tr><td style="background:#f7941d;padding:22px 28px"><a href="' + SITE + '" style="text-decoration:none"><img src="' + SITE + '/assets/logo-stacked-black.png" alt="DOCO" height="44" style="display:block;height:44px"></a></td></tr>' +
    '<tr><td style="padding:28px 28px 8px;font-size:15.5px">' + innerHtml + '</td></tr>' +
    '<tr><td style="background:#0b0b0b;color:#fff;padding:18px 28px;font-size:12px;line-height:1.6"><strong style="font-size:13px">Do More. Be More.</strong><br>DOCO — The Do Company · <a href="mailto:joyce@docostrips.com" style="color:#f7941d">joyce@docostrips.com</a> · 401-217-9740<br><span style="color:#9a9a9a">These statements have not been evaluated by the FDA. Products are not intended to diagnose, treat, cure or prevent any disease.</span></td></tr>' +
    '</table></td></tr></table></body></html>';
}

export function renderEmail(template, vars) {
  const subject = fillVars(template.subject, vars).replace(/\s+/g, ' ').trim().slice(0, 200);
  const text = fillVars(template.body, vars);
  return { subject, text, html: wrapHtml(textToHtml(text), { preheader: text.split('\n').find(l => l.trim()) || '' }) };
}

export function orderVars(order) {
  const s = order.shipping;
  return {
    name: (order.name || '').split(' ')[0] || 'there', reference: order.reference,
    items: (order.items || []).map(i => `${i.qty} × ${i.name} — ${money(i.amount)}`).join('\n'),
    total: money(order.total), mode: order.mode,
    ship_to: s ? [order.name, s.line1, s.line2, [s.city, s.state, s.postal].filter(Boolean).join(' ')].filter(Boolean).join('\n') : 'Address on file with Stripe',
  };
}

export function ownerOrderVars(session, order) {
  const shipping = session.collected_information?.shipping_details || session.shipping_details;
  const address = shipping?.address || order.shipping;
  return {
    ...orderVars(order),
    customer_name: order.name || shipping?.name || 'Not provided',
    customer_email: order.email || 'Not provided',
    ship_to: address ? [
      shipping?.name || order.name, address.line1, address.line2,
      [address.city, address.state, address.postal_code || address.postal].filter(Boolean).join(' '),
      address.country,
    ].filter(Boolean).join('\n') : 'Address on file with Stripe',
  };
}

export const SAMPLE_VARS = {
  customer_name: 'Jordan Lee', customer_email: 'customer@example.com',
  name: 'Jordan', reference: 'A1B2C3D4', items: '1 × Multivitamin DOCO Strips — $29.99\n1 × Sleep DOCO Strips — $29.99', total: '$59.98', mode: 'one-time',
  ship_to: 'Jordan Lee\n1 Main St\nProvidence RI 02903', code: 'LETSGO10', handle: '@jordan', renews_on: 'Nov 28', amount: '$25.49',
};

export function validateTemplate(input) {
  const subject = String(input?.subject ?? '').trim().slice(0, 200), body = String(input?.body ?? '').trim().slice(0, 12000);
  if (subject.length < 3) throw new Error('Subject is too short.');
  if (body.length < 10) throw new Error('Body is too short.');
  return { subject, body, enabled: input?.enabled !== false && input?.enabled !== 'false' };
}

export function validateSocialPost(input) {
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const platform = PLATFORMS.includes(input?.platform) ? input.platform : 'Other';
  const status = POST_STATUSES.includes(input?.status) ? input.status : 'planned';
  const when = new Date(input?.scheduledAt || '');
  if (Number.isNaN(when.getTime())) throw new Error('Pick a date and time.');
  const title = str(input?.title, 120);
  if (title.length < 2) throw new Error('Give the post a short title.');
  const link = str(input?.link, 500);
  if (link && !/^https?:\/\//i.test(link)) throw new Error('Links must start with http:// or https://');
  return { platform, status, scheduledAt: when.toISOString(), title, caption: str(input?.caption, 2200), link, notes: str(input?.notes, 1000) };
}

export function validateSettings(input, current) {
  const out = JSON.parse(JSON.stringify(current || DEFAULT_SETTINGS));
  const url = v => { const s = String(v ?? '').trim().slice(0, 500); if (s && !/^https:\/\//i.test(s)) throw new Error('Links must start with https://'); return s; };
  if (input.driveUrl !== undefined) out.driveUrl = url(input.driveUrl);
  if (Array.isArray(input.designLinks)) out.designLinks = input.designLinks.slice(0, 20).map(l => ({ label: String(l?.label ?? '').trim().slice(0, 60) || 'Link', url: url(l?.url) })).filter(l => l.url);
  if (input.email) {
    const e = input.email;
    if (e.fromName !== undefined) out.email.fromName = String(e.fromName).trim().slice(0, 60) || 'DOCO';
    if (e.fromEmail !== undefined) { const v = String(e.fromEmail).trim().toLowerCase().slice(0, 120); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw new Error('From email is not valid.'); out.email.fromEmail = v; }
    if (e.replyTo !== undefined) { const v = String(e.replyTo).trim().toLowerCase().slice(0, 120); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw new Error('Reply-to email is not valid.'); out.email.replyTo = v; }
  }
  if (input.reminders) {
    const r = input.reminders, n = (v, lo, hi, d) => { const x = parseInt(v, 10); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
    if (r.renewalDays !== undefined) out.reminders.renewalDays = n(r.renewalDays, 1, 14, 3);
    if (r.reorderDays !== undefined) out.reminders.reorderDays = n(r.reorderDays, 7, 60, 24);
  }
  return out;
}

export function validEmail(v) { return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 120; }
