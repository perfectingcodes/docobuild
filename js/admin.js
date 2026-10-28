/* DOCO admin dashboard — talks only to /api/admin/* on this origin. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (c) { return '$' + (Number(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var when = function (s) { var d = new Date(s * 1000); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  var whenIso = function (iso) { var d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  var login = $('#admLogin'), app = $('#admApp'), form = $('#loginForm'), err = $('#loginErr'), daysSel = $('#admDays');
  var state = { tab: 'overview', days: 30, orders: null };
  function api(path, opts) {
    return fetch('/api/admin/' + path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {})).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('Signed out'); }
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Request failed'); return d; });
    });
  }
  function showLogin() { login.hidden = false; app.hidden = true; $('#admLogout').hidden = true; setTimeout(function () { $('#admPw').focus(); }, 50); }
  function showApp(testMode) { login.hidden = true; app.hidden = false; $('#admLogout').hidden = false; $('#admEnv').hidden = !testMode; load(); }
  form.addEventListener('submit', function (e) {
    e.preventDefault(); err.hidden = true;
    api('login', { method: 'POST', body: JSON.stringify({ password: $('#admPw').value }) })
      .then(function () { $('#admPw').value = ''; return api('session'); }).then(function (s) { showApp(s.testMode); })
      .catch(function (ex) { err.textContent = ex.message === 'Signed out' ? 'Wrong password.' : ex.message; err.hidden = false; });
  });
  $('#admLogout').addEventListener('click', function () { api('logout', { method: 'POST' }).catch(function () {}).then(showLogin); });
  $('#admTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });
  app.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  daysSel.addEventListener('change', function () { state.days = +daysSel.value; $('#csvLink').href = '/api/admin/orders.csv?days=' + state.days; load(); });
  $('#admRefresh').addEventListener('click', load);
  function go(tab) { state.tab = tab; $$('#admTabs button').forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === tab); }); $$('.adm__panel').forEach(function (p) { p.hidden = p.dataset.panel !== tab; }); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function load() {
    var d = state.days;
    api('overview?days=' + d).then(renderOverview).catch(note('#kpis'));
    api('orders?days=' + d).then(function (r) { state.orders = r.orders; renderOrders(); renderLatest(); }).catch(note('#ordersList'));
    api('subscriptions').then(renderSubs).catch(note('#subsList'));
    api('carts').then(renderCarts).catch(note('#cartsList'));
    api('analytics?days=' + d).then(renderAnalytics).catch(note('#pagesList'));
    api('creators').then(renderCreators).catch(note('#creatorsList'));
    api('emails').then(renderEmails).catch(note('#emailsList'));
  }
  function note(sel) { return function (ex) { if (ex.message !== 'Signed out') $(sel).innerHTML = '<p class="adm__empty">' + esc(ex.message) + '</p>'; }; }
  function kpi(label, value, sub, color) { return '<div class="adm__kpi" style="--c:' + (color || 'var(--accent)') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }

  function renderOverview(o) {
    $('#kpis').innerHTML = kpi('Revenue', money(o.revenue), o.days + ' days' + (o.testMode ? ' · test mode' : ''), '#f7941d') + kpi('Orders', o.orders, 'AOV ' + money(o.aov), '#d63a30') +
      kpi('Visitors', o.visitors.toLocaleString(), o.pageviews.toLocaleString() + ' pageviews', '#2592c9') + kpi('Conversion', o.conversion + '%', o.subscriptionsActive + ' active subscriptions · ' + (o.emailSignups || 0) + ' emails', '#6a4fc9');
    $('#chartNote').textContent = 'Last ' + o.series.length + ' days';
    renderChart(o.series);
    var steps = [['Visitors', o.visitors], ['Added to bag', o.addToCart], ['Started checkout', o.checkoutStarts], ['Paid orders', o.orders]], max = Math.max(1, o.visitors);
    $('#funnel').innerHTML = steps.map(function (s) { return '<li><span>' + s[0] + '</span><div class="bar"><i style="width:' + Math.max(2, 100 * s[1] / max) + '%"></i></div><b>' + s[1].toLocaleString() + '</b></li>'; }).join('') +
      '<li><span>Quizzes taken</span><div class="bar"><i style="width:' + Math.max(2, Math.min(100, 100 * o.quizzes / max)) + '%;background:#6a4fc9"></i></div><b>' + o.quizzes + '</b></li>';
  }
  function renderChart(series) {
    var W = 600, H = 200, pad = 26, n = series.length, maxR = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.revenue; }))), maxV = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.visitors; })));
    var bw = (W - pad * 2) / n, bars = series.map(function (s, i) { var h = (H - pad) * s.revenue / maxR; return '<rect x="' + (pad + i * bw + bw * .18) + '" y="' + (H - pad - h) + '" width="' + (bw * .64) + '" height="' + h + '" rx="3" fill="#f7941d"><title>' + s.day + ': ' + money(s.revenue) + ' · ' + s.orders + ' orders</title></rect>'; }).join('');
    var pts = series.map(function (s, i) { return (pad + i * bw + bw / 2) + ',' + (H - pad - (H - pad) * s.visitors / maxV); }).join(' ');
    var labels = series.filter(function (_, i) { return n <= 10 || i % Math.ceil(n / 6) === 0; }).map(function (s) { var i = series.indexOf(s); return '<text x="' + (pad + i * bw + bw / 2) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="#8a8a8a">' + s.day.slice(5) + '</text>'; }).join('');
    $('#chart').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-label="Daily revenue bars and visitor line">' + bars + '<polyline points="' + pts + '" fill="none" stroke="#2592c9" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' + labels + '</svg>' +
      '<div class="adm__legend"><span><i style="background:#f7941d"></i>Revenue (max ' + money(maxR) + ')</span><span><i style="background:#2592c9"></i>Visitors (max ' + maxV + ')</span></div>';
  }
  function orderRow(o) {
    return '<tr><td><b>' + esc(o.name || '—') + '</b><br><small>' + esc(o.email) + '</small></td><td>' + when(o.created) + '</td><td class="wide">' + o.items.map(function (i) { return i.qty + '× ' + esc(i.name); }).join(', ') + (o.shipping ? '<br><small>' + esc(o.shipping.city) + (o.shipping.state ? ', ' + esc(o.shipping.state) : '') + '</small>' : '') + '</td>' +
      '<td><span class="adm__tag ' + (o.mode === 'subscription' ? 'adm__tag--sub' : '') + '">' + o.mode + '</span> <span class="adm__tag adm__tag--' + esc(o.status) + '">' + esc(o.status) + '</span><br><small>#' + o.reference + '</small></td><td class="num">' + money(o.total) + '</td></tr>';
  }
  function renderOrders() {
    var q = ($('#orderSearch').value || '').toLowerCase(), list = (state.orders || []).filter(function (o) { return !q || (o.name + ' ' + o.email + ' ' + o.reference).toLowerCase().indexOf(q) > -1; });
    $('#ordersList').innerHTML = list.length ? '<table class="adm__table"><thead><tr><th>Customer</th><th>When</th><th>Items</th><th>Type</th><th class="num">Total</th></tr></thead><tbody>' + list.map(orderRow).join('') + '</tbody></table>' : '<p class="adm__empty">No paid orders in this range yet.</p>';
  }
  $('#orderSearch').addEventListener('input', renderOrders);
  function renderLatest() { var l = (state.orders || []).slice(0, 5); $('#latestOrders').innerHTML = l.length ? '<div class="adm__rows">' + l.map(function (o) { return '<div class="adm__row"><div><b>' + esc(o.name || o.email) + '</b><br><small>' + when(o.created) + ' · ' + o.items.map(function (i) { return i.qty + '× ' + esc(i.name); }).join(', ') + '</small></div><b>' + money(o.total) + '</b></div>'; }).join('') + '</div>' : '<p class="adm__empty">No orders yet.</p>'; }
  function renderSubs(r) {
    var s = r.subscriptions || [], active = s.filter(function (x) { return x.status === 'active'; }).length;
    $('#subsNote').textContent = active + ' active · ' + money(s.filter(function (x) { return x.status === 'active'; }).reduce(function (t, x) { return t + x.amount; }, 0)) + ' monthly';
    $('#subsList').innerHTML = s.length ? '<table class="adm__table"><thead><tr><th>Customer</th><th>Started</th><th>Plan</th><th>Status</th><th class="num">Monthly</th></tr></thead><tbody>' + s.map(function (x) { return '<tr><td><b>' + esc(x.name || '—') + '</b><br><small>' + esc(x.email) + '</small></td><td>' + when(x.created) + '</td><td class="wide">' + x.items.map(function (i) { return i.qty + '× ' + esc(i.name); }).join(', ') + '<br><small>Renews ' + whenIso(x.currentPeriodEnd * 1000) + (x.cancelAtPeriodEnd ? ' · cancels at period end' : '') + '</small></td><td><span class="adm__tag adm__tag--' + esc(x.status) + '">' + esc(x.status) + '</span></td><td class="num">' + money(x.amount) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="adm__empty">No subscriptions yet.</p>';
  }
  function renderCarts(c) {
    $('#cartKpis').innerHTML = kpi('Open carts', c.sessions, 'sessions with items', '#f7941d') + kpi('Cart value', money(c.value), 'at list price', '#d63a30') + kpi('Reached checkout', c.abandonedAfterCheckout, 'then left Stripe', '#2592c9') + kpi('Items parked', Object.values(c.bySku).reduce(function (a, b) { return a + b; }, 0), 'across all carts', '#6a4fc9');
    var rows = Object.entries(c.bySku).sort(function (a, b) { return b[1] - a[1]; }), max = Math.max(1, rows[0] ? rows[0][1] : 1);
    $('#cartsList').innerHTML = rows.length ? '<ul class="adm__bars">' + rows.map(function (r) { return '<li><span>' + esc(c.catalog[r[0]] || r[0]) + '</span><div class="bar"><i style="width:' + (100 * r[1] / max) + '%"></i></div><b>' + r[1] + '</b></li>'; }).join('') + '</ul>' : '<p class="adm__empty">No open carts right now.</p>';
  }
  function bars(sel, rows, labelKey, valKey, color, nameMap) {
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return Number(r[valKey]); })));
    $(sel).innerHTML = rows.length ? '<ul class="adm__bars">' + rows.map(function (r) { var l = r[labelKey] == null ? '—' : r[labelKey]; return '<li><span>' + esc(nameMap ? (nameMap[l] || l) : l) + '</span><div class="bar"><i style="width:' + (100 * Number(r[valKey]) / max) + '%;--c:' + color + '"></i></div><b>' + Number(r[valKey]).toLocaleString() + '</b></li>'; }).join('') + '</ul>' : '<p class="adm__empty">No data yet.</p>';
  }
  function renderAnalytics(a) {
    bars('#pagesList', a.pages, 'path', 'views', '#f7941d'); bars('#refsList', a.referrers, 'ref', 'visitors', '#2592c9'); bars('#devicesList', a.devices, 'device', 'visitors', '#6a4fc9');
    bars('#quizList', a.quiz, 'sku', 'n', '#d63a30', a.catalog); bars('#atcList', a.addToCartBySku, 'sku', 'n', '#2f9e63', a.catalog);
  }
  function renderCreators(r) {
    var l = r.applications || []; $('#creatorsNote').textContent = l.filter(function (x) { return x.status === 'new'; }).length + ' new';
    $('#creatorsList').innerHTML = l.length ? '<div class="adm__rows">' + l.map(function (x) { return '<div class="adm__row" data-id="' + esc(x.id) + '"><div><b>' + esc(x.name) + '</b> <small>' + esc(x.handle) + (x.platform ? ' · ' + esc(x.platform) : '') + (x.audience ? ' · ' + esc(x.audience) : '') + '</small><br><small>' + esc(x.email) + (x.website ? ' · ' + esc(x.website) : '') + ' · ' + whenIso(x.ts) + '</small>' + (x.message ? '<p class="adm__msg">' + esc(x.message) + '</p>' : '') + '</div><select class="adm__status" data-status>' + ['new', 'contacted', 'approved', 'declined'].map(function (s) { return '<option' + (s === x.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>'; }).join('') + '</div>' : '<p class="adm__empty">No applications yet. Share docostrips.com/creators.html with creators.</p>';
  }
  $('#creatorsList').addEventListener('change', function (e) { var s = e.target.closest('[data-status]'); if (!s) return; var id = s.closest('[data-id]').dataset.id; api('creators/' + id, { method: 'POST', body: JSON.stringify({ status: s.value }) }).catch(function (ex) { alert(ex.message); }); });

  function renderEmails(r) {
    var l = r.emails || []; $('#emailsNote').textContent = l.length + ' signups · code ' + (r.code || '');
    $('#emailsList').innerHTML = l.length ? '<table class="adm__table"><thead><tr><th>Email</th><th>When</th><th>Source</th><th>Code</th></tr></thead><tbody>' + l.map(function (x) { return '<tr><td>' + esc(x.email) + '</td><td>' + whenIso(x.ts) + '</td><td><span class="adm__tag">' + esc(x.source || 'popup') + '</span></td><td class="num">' + esc(x.code || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="adm__empty">No signups yet. The welcome popup collects them on the home page.</p>';
  }
  api('session').then(function (s) { showApp(s.testMode); }).catch(showLogin);
})();
