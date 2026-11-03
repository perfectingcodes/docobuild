import test from 'node:test';
import assert from 'node:assert/strict';
import { fillVars, textToHtml, renderEmail, orderVars, validateTemplate, validateSocialPost, validateSettings, DEFAULT_TEMPLATES, DEFAULT_SETTINGS, EMAIL_KINDS, SAMPLE_VARS } from '../server/studio-lib.mjs';

test('placeholders fill, unknown ones vanish, html is escaped', () => {
  assert.equal(fillVars('Hi {{name}} {{ nope }}!', { name: 'Jo' }), 'Hi Jo !');
  const html = textToHtml('**Bold** <script>x</script>\nline2\n\nhttps://docostrips.com/shop');
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<br>line2/);
  assert.match(html, /<a href="https:\/\/docostrips\.com\/shop"/);
});
test('every default template renders with the sample variables and no empty placeholders', () => {
  for (const kind of Object.keys(EMAIL_KINDS)) {
    const m = renderEmail(DEFAULT_TEMPLATES[kind], SAMPLE_VARS);
    assert.ok(m.subject.length > 5, kind);
    assert.doesNotMatch(m.text, /\{\{/, kind);
    assert.match(m.html, /Do More\. Be More\./);
  }
});
test('order variables summarise a Stripe order', () => {
  const v = orderVars({ name: 'Jordan Lee', reference: 'ABCD1234', total: 5998, mode: 'one-time', items: [{ qty: 2, name: 'Sleep', amount: 5998 }], shipping: { line1: '1 Main St', city: 'Providence', state: 'RI', postal: '02903' } });
  assert.equal(v.name, 'Jordan'); assert.equal(v.total, '$59.98'); assert.match(v.items, /2 × Sleep — \$59\.98/); assert.match(v.ship_to, /Providence RI 02903/);
});
test('template, post and settings validation reject junk and clamp values', () => {
  assert.throws(() => validateTemplate({ subject: 'x', body: 'long enough body' }), /Subject/);
  assert.throws(() => validateSocialPost({ title: 'Reel', scheduledAt: 'nope' }), /date/);
  assert.throws(() => validateSocialPost({ title: 'Reel', scheduledAt: '2026-11-05T10:00', link: 'ftp://x' }), /http/);
  const p = validateSocialPost({ title: 'Launch reel', scheduledAt: '2026-11-05T10:00:00Z', platform: 'Bogus', status: 'posted' });
  assert.equal(p.platform, 'Other'); assert.equal(p.status, 'posted');
  assert.throws(() => validateSettings({ driveUrl: 'http://insecure' }, DEFAULT_SETTINGS), /https/);
  const s = validateSettings({ driveUrl: 'https://drive.google.com/x', email: { fromEmail: 'hello@docostrips.com' }, reminders: { renewalDays: 99, reorderDays: 1 } }, DEFAULT_SETTINGS);
  assert.equal(s.driveUrl, 'https://drive.google.com/x'); assert.equal(s.reminders.renewalDays, 14); assert.equal(s.reminders.reorderDays, 7);
  assert.equal(s.email.replyTo, 'joyce@docostrips.com');
});
