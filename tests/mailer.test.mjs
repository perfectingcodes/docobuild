import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailer } from '../server/mailer.mjs';

test('Resend uses the connected integration without extracting credentials', async () => {
  const calls = [];
  const mailer = createMailer({
    listConnections: async () => [{ id: 'email-connection', environment: 'production' }],
    proxy: async (...args) => { calls.push(args); return { ok: true, json: async () => ({ id: 'email-id' }) }; },
  });
  assert.equal(mailer.connected(), false);
  await assert.rejects(mailer.send({}), /not connected/);
  await mailer.initialize();
  assert.equal(mailer.connected(), true);
  assert.equal(await mailer.send({ from: 'DOCO <orders@example.com>', to: 'test@example.com', subject: 'Test', text: 'Hello', replyTo: 'help@example.com' }), 'email-id');
  const [provider, endpoint, options] = calls[0];
  assert.equal(provider, 'resend');
  assert.equal(endpoint, '/emails');
  assert.equal(options.connectionId, 'email-connection');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(options.body), { from: 'DOCO <orders@example.com>', to: ['test@example.com'], subject: 'Test', text: 'Hello', reply_to: 'help@example.com' });
});

test('missing, disabled or ambiguous email connections cannot send', async () => {
  for (const rows of [[], [{ id: 'disabled', disabled: true }], [{ id: 'a' }, { id: 'b' }]]) {
    const mailer = createMailer({ listConnections: async () => rows });
    try { await mailer.initialize(); } catch (error) { assert.match(error.message, /Multiple/); }
    assert.equal(mailer.connected(), false);
    await assert.rejects(mailer.send({}), /not connected/);
  }
});

test('provider errors and invalid success responses fail explicitly', async () => {
  for (const response of [
    { ok: false, status: 403, json: async () => ({ message: 'Domain is not verified' }) },
    { ok: true, json: async () => ({}) },
  ]) {
    const mailer = createMailer({ listConnections: async () => [{ id: 'a' }], proxy: async () => response });
    await mailer.initialize();
    await assert.rejects(mailer.send({}), /Domain is not verified|email ID/);
  }
});
