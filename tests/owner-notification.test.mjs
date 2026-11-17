import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../server/studio.mjs';
import { DEFAULT_SETTINGS } from '../server/studio-lib.mjs';

function fixture({ customerFails = false, ownerFails = false, connected = true, overrides = {} } = {}) {
  const sent = [], logs = [];
  let retrievals = 0;
  const session = {
    id: 'cs_test_owner_notification_12345678', status: 'complete', payment_status: 'paid',
    livemode: process.env.NODE_ENV === 'production', metadata: { doco_checkout: 'true' },
    mode: 'payment', amount_total: 4797, created: 1,
    customer_details: { name: 'Test Buyer', email: 'customer@example.com' },
    line_items: { data: [{ description: 'Multivitamin', quantity: 1, amount_total: 2999 },
      { description: 'Sample Pack', quantity: 1, amount_total: 1199 },
      { description: 'US shipping', quantity: 1, amount_total: 599 }] },
    collected_information: { shipping_details: { name: 'Test Recipient', address: {
      line1: '1 Example Street', line2: 'Suite 2', city: 'Test City', state: 'NY', postal_code: '10001', country: 'US',
    } } },
    ...overrides,
  };
  const pool = { query: async (sql, params) => {
    if (sql.includes('SELECT value')) return { rows: [{ value: { ...DEFAULT_SETTINGS, email: { ...DEFAULT_SETTINGS.email, fromEmail: 'sender@example.com' } } }] };
    if (sql.includes('FROM public.email_templates')) return { rows: [] };
    if (sql.startsWith('SELECT 1')) return { rows: logs.filter(l => l.kind === params[0] && l.ref === params[1] && l.status === 'sent') };
    if (sql.startsWith('INSERT INTO public.email_log')) {
      logs.push({ kind: params[1], to: params[2], status: params[4], ref: params[5] });
      return { rows: [] };
    }
    throw new Error('Unexpected query in notification test');
  } };
  const studio = createStudio({
    pool, mailConnected: () => connected,
    stripe: { checkout: { sessions: {
      retrieve: async () => { retrievals++; return structuredClone(session); },
      listLineItems: () => ({ autoPagingToArray: async () => session.line_items.data }),
    } } },
    sendEmail: async mail => {
      if ((customerFails && mail.to === 'customer@example.com') || (ownerFails && mail.to === 'joyce@docostrips.com')) throw new Error('Simulated email rejection');
      sent.push(mail); return 'email-test-id';
    },
  });
  return { studio, session, sent, logs, allowOwnerSend: () => { ownerFails = false; }, retrievals: () => retrievals,
    event: (type = 'checkout.session.completed') => ({ type, data: { object: structuredClone(session) } }) };
}

test('paid checkout sends separate customer and owner emails, with real order details, once', async () => {
  const f = fixture();
  await f.studio.onStripeEvent(f.event());
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[0].to, 'customer@example.com');
  const owner = f.sent[1];
  assert.equal(owner.to, 'joyce@docostrips.com');
  assert.match(owner.subject, /New paid DOCO order/);
  for (const text of ['1 × Multivitamin — $29.99', '1 × Sample Pack — $11.99', '$47.97',
    'customer@example.com', 'Test Recipient', '1 Example Street', 'Suite 2', 'Test City NY 10001', 'US']) {
    assert.ok(owner.text.includes(text), text);
  }
  assert.equal(owner.idempotencyKey, `doco-owner-order-${f.session.id}`);
  await f.studio.onStripeEvent(f.event());
  assert.equal(f.sent.length, 2, 'Repeated webhook does not send duplicate emails');
});

test('owner notifications also cover subscription checkouts and delayed successful payments', async () => {
  const f = fixture({ overrides: { mode: 'subscription' } });
  await f.studio.onStripeEvent(f.event('checkout.session.async_payment_succeeded'));
  assert.equal(f.sent.length, 2);
  assert.match(f.sent[1].text, /Purchase type: subscription/);
});

test('unpaid, foreign-store, wrong-environment and irrelevant events send nothing', async () => {
  for (const overrides of [{ payment_status: 'unpaid' }, { metadata: {} },
    { livemode: process.env.NODE_ENV !== 'production' }]) {
    const f = fixture({ overrides });
    await f.studio.onStripeEvent(f.event());
    assert.equal(f.sent.length, 0);
    assert.equal(f.retrievals(), 0);
  }
  const f = fixture();
  await f.studio.onStripeEvent(f.event('payment_intent.created'));
  assert.equal(f.sent.length, 0);
});

test('retrieved Stripe session must independently confirm payment', async () => {
  const f = fixture();
  const event = f.event();
  f.session.payment_status = 'unpaid';
  await f.studio.onStripeEvent(event);
  assert.equal(f.sent.length, 0);
});

test('owner email is independent of a failed customer email, and failed owner sends can retry', async () => {
  const f = fixture({ customerFails: true });
  await f.studio.onStripeEvent(f.event());
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].to, 'joyce@docostrips.com');
  assert.ok(f.logs.some(l => l.kind === 'order_confirmation' && l.status === 'failed'));
  const failed = fixture({ ownerFails: true });
  await failed.studio.onStripeEvent(failed.event());
  assert.equal(failed.sent[0].to, 'customer@example.com');
  assert.ok(failed.logs.some(l => l.kind === 'owner_order' && l.status === 'failed'));
  failed.allowOwnerSend();
  await failed.studio.onStripeEvent(failed.event());
  assert.equal(failed.sent.length, 2);
  assert.equal(failed.sent.filter(mail => mail.to === 'customer@example.com').length, 1);
  assert.equal(failed.sent.filter(mail => mail.to === 'joyce@docostrips.com').length, 1);
});

test('a disconnected email provider sends nothing', async () => {
  const f = fixture({ connected: false });
  await f.studio.onStripeEvent(f.event());
  assert.equal(f.sent.length, 0);
});
