/* Creators page: step explorer, earnings illustration, application form. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  /* program terms: edit here and in the perks copy */
  var TERMS = { commission: 0.20, discount: 0.15, aov: 45, clickRate: 0.02, orderRate: 0.03 };

  /* ---- step explorer ---- */
  var steps = $$('.cr-step'), tabs = $$('.cr-steps__tab'), dots = $$('.cr-steps__dots i'), cur = 0;
  function show(i) { cur = (i + steps.length) % steps.length; steps.forEach(function (s, k) { s.classList.toggle('is-on', k === cur); }); tabs.forEach(function (t, k) { t.classList.toggle('is-on', k === cur); t.setAttribute('aria-selected', k === cur); }); dots.forEach(function (d, k) { d.classList.toggle('is-on', k === cur); }); }
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(+t.dataset.step); }); });
  $$('[data-stepdir]').forEach(function (b) { b.addEventListener('click', function () { show(cur + Number(b.dataset.stepdir)); }); });
  var panels = $('.cr-steps__panels'), sx = null;
  if (panels) {
    panels.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    panels.addEventListener('touchend', function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); sx = null; }, { passive: true });
  }

  /* ---- earnings illustration ---- */
  var range = $('#crAud'), eng = 1;
  function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function calc() {
    if (!range) return;
    var aud = +range.value, orders = aud * TERMS.clickRate * TERMS.orderRate * eng;
    $('#crAudVal').textContent = aud.toLocaleString('en-US');
    $('#crEarn').textContent = fmt(orders * TERMS.aov * TERMS.commission);
    $('#crOrders').textContent = Math.round(orders).toLocaleString('en-US');
    $('#crSaves').textContent = fmt(orders * TERMS.aov * TERMS.discount);
  }
  if (range) { range.addEventListener('input', calc); calc(); }
  $$('.cr-calc__chips button').forEach(function (b) { b.addEventListener('click', function () { eng = +b.dataset.eng; $$('.cr-calc__chips button').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', x === b); }); calc(); }); });

  /* ---- application form ---- */
  var form = $('#crForm'), done = $('#crDone'), err = $('#crErr'), submit = $('#crSubmit');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault(); err.hidden = true;
    var data = {}; new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });
    if (data.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) { err.textContent = 'Please add your name and a valid email.'; err.hidden = false; form.reportValidity(); return; }
    submit.disabled = true; var orig = submit.innerHTML; submit.textContent = 'Sending…';
    fetch('/api/creators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Could not send'); return d; }); })
      .then(function () {
        try { navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([JSON.stringify({ type: 'creator_apply', sid: localStorage.getItem('doco_sid') || 'anon-creator', path: location.pathname, device: innerWidth < 700 ? 'mobile' : 'desktop', meta: { platform: data.platform, audience: data.audience } })], { type: 'application/json' })); } catch (_) {}
        form.hidden = true; done.hidden = false; done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (ex) {
        submit.disabled = false; submit.innerHTML = orig;
        var mail = 'mailto:joyce@docostrips.com?subject=' + encodeURIComponent('Creator application — ' + data.name) + '&body=' + encodeURIComponent('Name: ' + data.name + '\nEmail: ' + data.email + '\nHandle: ' + data.handle + '\nPlatform: ' + data.platform + '\nAudience: ' + data.audience + '\nWebsite: ' + data.website + '\n\n' + data.message);
        err.innerHTML = ex.message + ' You can also <a href="' + mail + '">email your application</a> instead.'; err.hidden = false;
      });
  });
})();
