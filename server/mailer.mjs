import { ReplitConnectors } from '@replit/connectors-sdk';

// Authentication stays in the connected integration, never in browser code.
export function createMailer(connectors) {
  let connectionId = null;
  return {
    async initialize() {
      connectionId = null;
      const rows = (await connectors.listConnections({ connector_names: 'resend' })).filter(row => !row.disabled);
      const current = rows.filter(row => row.environment === (process.env.NODE_ENV === 'production' ? 'production' : 'development'));
      const candidates = current.length ? current : rows;
      if (candidates.length > 1) throw new Error('Multiple Resend connections; select one before sending.');
      connectionId = candidates[0]?.id || null;
      return !!connectionId;
    },
    connected() { return !!connectionId; },
    async send({ from, to, subject, html, text, replyTo, idempotencyKey }) {
      if (!connectionId) throw new Error('Resend is not connected. Connect Resend in Integrations and restart the app.');
      const res = await connectors.proxy('resend', '/emails', {
        connectionId, method: 'POST', headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
        body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Resend error ${res.status}`);
      if (!data.id) throw new Error('Resend did not return an email ID.');
      return data.id;
    },
  };
}

const mailer = createMailer(new ReplitConnectors());
export const initializeMailer = () => mailer.initialize();
export const resendConnected = () => mailer.connected();
export const resendSend = message => mailer.send(message);
