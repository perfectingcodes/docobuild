export function selectStripeConnection(rows, production) {
  const environment = production ? 'production' : 'development';
  const matches = rows.filter(row => row.environment === environment && !row.disabled);
  if (matches.length !== 1) {
    throw new Error(`Exactly one enabled ${environment} Stripe connection is required.`);
  }
  return matches[0].id;
}
