import { CATALOG } from './catalog.mjs';

// Merchant-created live records use these names. Reuse them without renaming,
// deleting, or adding another set of products.
const aliases = {
  sleep: ['Sleep DOCO Strips'],
  'duo-domore': ['The More Duo'],
};

export function findCatalogProduct(products, sku, mode) {
  const names = [CATALOG[sku].name, ...(aliases[sku] || [])];
  const subscriptionNames = names.map(name => `${name} Subscription`);
  const allowed = products.filter(p => p.active !== false);
  const groups = [
    mode === 'sub' ? allowed.filter(p => subscriptionNames.includes(p.name)) : [],
    allowed.filter(p => p.metadata?.doco_sku === sku &&
      (mode === 'sub' || !p.name.endsWith(' Subscription'))),
    allowed.filter(p => names.includes(p.name)),
  ];
  for (const group of groups) {
    if (group.length > 1) throw new Error(`Multiple Stripe products match ${sku}/${mode}; review before setup.`);
    if (group.length === 1) return group[0];
  }
  return undefined;
}
