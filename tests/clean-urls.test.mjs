import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRedirect } from '../server/clean-urls.mjs';

test('legacy .html page addresses redirect to clean paths, query preserved', () => {
  assert.equal(cleanRedirect('/shop.html'), '/shop');
  assert.equal(cleanRedirect('/index.html'), '/');
  assert.equal(cleanRedirect('/product.html?sku=multi'), '/product?sku=multi');
  assert.equal(cleanRedirect('/thanks.html?session_id=cs_live_x&proof=abc'), '/thanks?session_id=cs_live_x&proof=abc');
  assert.equal(cleanRedirect('/admin.html'), '/admin');
});
test('non-page and already-clean addresses are left alone', () => {
  for (const u of ['/shop', '/', '/api/commerce', '/css/style.css', '/evil.html', '/nested/shop.html', '/shop.html/x']) assert.equal(cleanRedirect(u), null);
});
