/* Standard Meta Pixel bootstrap, kept external to preserve the site's CSP. */
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1743915574010251');
fbq('track', 'PageView');

window.docoMeta = function (event, data, options) {
  if (typeof window.fbq === 'function') window.fbq('track', event, data, options);
};
window.docoMetaPurchase = function (status) {
  if (!status.paid || !status.sessionId || !Number.isInteger(status.amount_total) ||
      status.currency !== 'usd') return;
  var key = 'doco_meta_purchase_' + status.sessionId;
  // Persistent per-browser deduplication, plus Meta's stable event ID.
  if (window.__docoPurchases && window.__docoPurchases[key]) return;
  try { if (localStorage.getItem(key)) return; } catch (_) {}
  window.docoMeta('Purchase', {
    value: status.amount_total / 100, currency: 'USD',
    content_ids: status.content_ids, content_type: 'product'
  }, { eventID: status.sessionId });
  window.__docoPurchases = window.__docoPurchases || {};
  window.__docoPurchases[key] = true;
  try { localStorage.setItem(key, '1'); } catch (_) {}
};
