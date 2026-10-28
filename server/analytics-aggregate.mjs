// Pure helpers for the admin dashboard; no I/O so they are unit-testable.
export const EVENT_TYPES = new Set(['pageview', 'add_to_cart', 'cart_update', 'checkout_start', 'quiz_complete', 'builder_pick', 'creator_apply']);
export const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
export function cleanEvent(body) {
  if (!body || typeof body !== 'object') return null;
  const type = String(body.type || '');
  if (!EVENT_TYPES.has(type)) return null;
  const sid = String(body.sid || '');
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(sid)) return null;
  const path = String(body.path || '/').slice(0, 120).replace(/[^a-zA-Z0-9/._?=&-]/g, '');
  const ref = String(body.ref || '').slice(0, 120).replace(/[^a-zA-Z0-9.:/_-]/g, '');
  const device = DEVICES.has(body.device) ? body.device : 'desktop';
  let meta = {};
  if (body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)) {
    const json = JSON.stringify(body.meta);
    if (json.length <= 2000) meta = JSON.parse(json);
  }
  return { type, sid, path, ref, device, meta };
}
export function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }
export function buildSeries(days, orders, visitorRows, now = Date.now()) {
  // orders: [{created (unix s), amount_total (cents)}]; visitorRows: [{day:'YYYY-MM-DD', visitors:n, pageviews:n}]
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(now - i * 86400000);
    out.push({ day, revenue: 0, orders: 0, visitors: 0, pageviews: 0 });
  }
  const idx = new Map(out.map((r, i) => [r.day, i]));
  for (const o of orders) { const k = dayKey(o.created * 1000); if (idx.has(k)) { const r = out[idx.get(k)]; r.revenue += o.amount_total || 0; r.orders += 1; } }
  for (const v of visitorRows) { if (idx.has(v.day)) { const r = out[idx.get(v.day)]; r.visitors = Number(v.visitors) || 0; r.pageviews = Number(v.pageviews) || 0; } }
  return out;
}
export function summarizeOrders(orders) {
  const revenue = orders.reduce((s, o) => s + (o.amount_total || 0), 0);
  return { revenue, orders: orders.length, aov: orders.length ? Math.round(revenue / orders.length) : 0 };
}
export function liveCarts(snapshots, catalog) {
  // snapshots: latest cart_update per session → [{sid, meta:{items:[{sku,mode,qty}]}, ts}]
  const bySku = {}; let sessions = 0, value = 0;
  for (const s of snapshots) {
    const items = Array.isArray(s.meta?.items) ? s.meta.items : [];
    if (!items.length) continue;
    sessions += 1;
    for (const it of items) {
      const price = catalog[it.sku]?.[it.mode === 'sub' ? 'sub' : 'once'];
      if (!price) continue;
      const qty = Math.min(20, Math.max(1, Number(it.qty) || 1));
      bySku[it.sku] = (bySku[it.sku] || 0) + qty;
      value += price * qty;
    }
  }
  return { sessions, value, bySku };
}
export function sessionToOrder(s) {
  const items = (s.line_items?.data || []).map(li => ({ name: li.description || li.price?.nickname || 'Item', qty: li.quantity || 1, amount: li.amount_total || 0 }));
  const sub = s.mode === 'subscription';
  return {
    id: s.id, reference: s.id.slice(-8).toUpperCase(), created: s.created, livemode: !!s.livemode,
    email: s.customer_details?.email || '', name: s.customer_details?.name || s.shipping_details?.name || '',
    phone: s.customer_details?.phone || '',
    total: s.amount_total || 0, currency: s.currency || 'usd', mode: sub ? 'subscription' : 'one-time',
    status: s.payment_status, items,
    shipping: s.shipping_details?.address ? { city: s.shipping_details.address.city || '', state: s.shipping_details.address.state || '', postal: s.shipping_details.address.postal_code || '', line1: s.shipping_details.address.line1 || '' } : null,
    subscription: s.subscription || null,
  };
}
export function ordersCsv(orders) {
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const head = ['reference', 'date', 'name', 'email', 'phone', 'mode', 'status', 'total_usd', 'items', 'ship_to'];
  const rows = orders.map(o => [o.reference, new Date(o.created * 1000).toISOString(), o.name, o.email, o.phone, o.mode, o.status,
    (o.total / 100).toFixed(2), o.items.map(i => `${i.qty}x ${i.name}`).join('; '),
    o.shipping ? `${o.shipping.line1}, ${o.shipping.city} ${o.shipping.state} ${o.shipping.postal}` : ''].map(esc).join(','));
  return [head.join(','), ...rows].join('\n');
}
