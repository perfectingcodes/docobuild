import { pool, account } from './stripe.mjs';
export async function listCheckoutPrices() {
  const result = await pool.query(`
    SELECT p.id, p.unit_amount, p.livemode, pr.metadata->>'doco_sku' AS sku,
      CASE WHEN p.type='one_time' THEN 'once' ELSE 'sub' END AS mode
    FROM stripe.prices p JOIN stripe.products pr
      ON pr.id=p.product AND pr._account_id=p._account_id
    WHERE p._account_id=$1 AND p.livemode=$2 AND pr.livemode=$2
      AND p.active=true AND pr.active=true AND p.currency='usd'
      AND (p.type='one_time' OR
        (p.recurring->>'interval'='month' AND (p.recurring->>'interval_count')::int=1))
  `, [account.id, process.env.NODE_ENV === 'production']);
  return result.rows;
}
