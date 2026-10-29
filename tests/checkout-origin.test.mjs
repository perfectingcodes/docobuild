import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutOrigin } from '../server/checkout-origin.mjs';

test('production checkout accepts both verified storefront domains', () => {
  for (const origin of ['https://docostrips.com', 'https://docobuild.replit.app']) {
    assert.equal(checkoutOrigin(origin), origin);
  }
});

test('production rejects missing, insecure, lookalike and development origins', () => {
  for (const origin of [undefined, 'null', 'http://docostrips.com',
    'https://docostrips.com.evil.test', 'https://evil.test', 'https://preview.replit.dev',
    'http://127.0.0.1:5000', 'https://docostrips.com:9999']) {
    assert.equal(checkoutOrigin(origin, { devDomain: 'preview.replit.dev' }), null);
  }
});

test('development permits only the configured preview and local workflow', () => {
  const options = { production: false, devDomain: 'preview.replit.dev' };
  for (const origin of ['https://preview.replit.dev', 'http://127.0.0.1:5000']) {
    assert.equal(checkoutOrigin(origin, options), origin);
  }
  assert.equal(checkoutOrigin('https://other.replit.dev', options), null);
});
