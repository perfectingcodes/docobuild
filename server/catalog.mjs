// Approved advertised prices. Runtime checkout must find matching active Stripe
// Prices in the synced Stripe schema; client-supplied prices are never trusted.
export const CATALOG = {
  multi: { name: 'Multivitamin DOCO Strips', once: 2999, sub: 2549 },
  sport: { name: 'Sports Energy DOCO Strips', once: 2999, sub: 2549 },
  calm: { name: 'Calm + Stress DOCO Strips', once: 2999, sub: 2549 },
  sleep: { name: 'Sleep Strips', once: 2999, sub: 2549 },
  'duo-domore': { name: 'The Do More Duo', once: 4499, sub: 3824 },
  'duo-relax': { name: 'The Relaxation Duo', once: 4499, sub: 3824 },
  stack: { name: 'The Variety Pack', once: 7999, sub: 7199 },
};
export function normalizeCart(items) {
  if (!Array.isArray(items) || !items.length || items.length > 20) {
    throw new Error('Your bag must contain between 1 and 20 items.');
  }
  const lines = new Map();
  for (const item of items) {
    if (!item || !Object.hasOwn(CATALOG, item.sku) ||
        !['once', 'sub'].includes(item.mode) || !Number.isInteger(item.qty) ||
        item.qty < 1 || item.qty > 20) throw new Error('Invalid item or quantity in your bag.');
    const key = `${item.sku}:${item.mode}`;
    const next = (lines.get(key)?.qty || 0) + item.qty;
    if (next > 20) throw new Error('Maximum quantity is 20 per product and purchase option.');
    lines.set(key, { sku: item.sku, mode: item.mode, qty: next });
  }
  return [...lines.values()].sort((a, b) =>
    `${a.sku}:${a.mode}`.localeCompare(`${b.sku}:${b.mode}`));
}
export function cartTotals(items) {
  let first = 0, monthly = 0;
  for (const item of items) {
    const amount = CATALOG[item.sku][item.mode] * item.qty;
    first += amount;
    if (item.mode === 'sub') monthly += amount;
  }
  return {
    first, monthly,
    firstShipping: first > 4500 ? 0 : 599,
    monthlyShipping: monthly ? (monthly > 4500 ? 0 : 599) : 0,
  };
}
