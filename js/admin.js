/* DOCO admin dashboard — talks only to /api/admin/* on this origin. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (c) { return '$' + (Number(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var dayStart = function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  var when = function (s) { var d = new Date(s * 1000), today = d.getTime() >= dayStart(); return (today ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  var whenIso = function (iso) { var d = new Date(iso); return d.getTime() >= dayStart() ? 'Today ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  var login = $('#admLogin'), app = $('#admApp'), form = $('#loginForm'), err = $('#loginErr'), daysSel = $('#admDays');
  var TITLES = { overview: 'Overview', orders: 'Orders', carts: 'Carts', analytics: 'Insights', people: 'People' };
  var state = { tab: 'overview', sub: { orders: 'orders', people: 'creators' }, days: 30, filter: 'all', open: null, orders: null, subs: null, creators: null, emails: null, carts: null, testMode: false };

  function api(path, opts) {
    return fetch('/api/admin/' + path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {})).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('Signed out'); }
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Request failed'); return d; });
    });
  }
  function showLogin() { login.hidden = false; app.hidden = true; setTimeout(function () { $('#admPw').focus(); }, 50); }
  function showApp(testMode) { state.testMode = !!testMode; login.hidden = true; app.hidden = false; $('#admEnv').hidden = !testMode; $('#admEnvSm').hidden = !testMode; load(); }
  form.addEventListener('submit', function (e) {
    e.preventDefault(); err.hidden = true;
    api('login', { method: 'POST', body: JSON.stringify({ password: $('#admPw').value }) })
      .then(function () { $('#admPw').value = ''; return api('session'); }).then(function (s) { showApp(s.testMode); })
      .catch(function (ex) { err.textContent = ex.message === 'Signed out' ? 'Wrong password.' : ex.message; err.hidden = false; });
  });
  function signOut() { api('logout', { method: 'POST' }).catch(function () {}).then(showLogin); }
  $('#admLogout').addEventListener('click', signOut); $('#admLogoutSm').addEventListener('click', signOut);
  $('#admRefresh').addEventListener('click', load); $('#admRefreshSm').addEventListener('click', load);
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab],[data-go],[data-sub],[data-filter],.adm__order');
    if (!t) return;
    if (t.dataset.tab) return go(t.dataset.tab);
    if (t.dataset.go) return go(t.dataset.go, t.dataset.sub2);
    if (t.dataset.sub) return setSub(t.closest('.adm__panel').dataset.panel, t.dataset.sub);
    if (t.dataset.filter) { state.filter = t.dataset.filter; $$('#orderChips button').forEach(function (b) { b.classList.toggle('is-on', b === t); }); return renderOrders(); }
    if (t.classList.contains('adm__order') && !e.target.closest('a')) { state.open = state.open === t.dataset.id ? null : t.dataset.id; renderOrders(); }
  });
  daysSel.addEventListener('change', function () { state.days = +daysSel.value; $('#csvLink').href = '/api/admin/orders.csv?days=' + state.days; load(); });
  $('#orderSearch').addEventListener('input', renderOrders);

  function go(tab, sub) {
    state.tab = tab;
    $$('[data-tab]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === tab); });
    $$('.adm__panel').forEach(function (p) { p.hidden = p.dataset.panel !== tab; });
    $('#pTitle').textContent = TITLES[tab] || tab;
    if (sub) setSub(tab, sub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function setSub(panel, sub) {
    state.sub[panel] = sub; var p = $('[data-panel="' + panel + '"]');
    $$('[data-sub]', p).forEach(function (b) { b.classList.toggle('is-on', b.dataset.sub === sub); });
    $$('[data-subpanel]', p).forEach(function (x) { x.hidden = x.dataset.subpanel !== sub; });
  }
  function spin(on) { $$('#admRefresh,#admRefreshSm').forEach(function (b) { b.classList.toggle('is-spin', on); }); }
  function load() {
    var d = state.days; spin(true);
    Promise.all([
      api('overview?days=' + d).then(renderOverview).catch(note('#kpis')),
      api('orders?days=' + d).then(function (r) { state.orders = r.orders; renderOrders(); renderLatest(); }).catch(note('#ordersList')),
      api('subscriptions').then(function (r) { state.subs = r.subscriptions || []; renderSubs(); }).catch(note('#subsList')),
      api('carts').then(function (c) { state.carts = c; renderCarts(c); }).catch(note('#cartsList')),
      api('analytics?days=' + d).then(renderAnalytics).catch(note('#pagesList')),
      api('creators').then(function (r) { state.creators = r.applications || []; renderCreators(); }).catch(note('#creatorsList')),
      api('emails').then(function (r) { state.emails = r.emails || []; state.code = r.code; renderEmails(); }).catch(note('#emailsList'))
    ]).then(function () { spin(false); renderToday(); renderAttention(); $('#admUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); });
  }
  function note(sel) { return function (ex) { if (ex.message !== 'Signed out') $(sel).innerHTML = '<p class="adm__empty">' + esc(ex.message) + '</p>'; }; }
  function kpi(label, value, sub, color) { return '<div class="adm__kpi" style="--c:' + (color || 'var(--accent)') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function tile(label, value, sub, accent) { return '<div class="adm__tile' + (accent ? ' adm__tile--accent' : '') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function badge(name, n) { $$('[data-badge="' + name + '"]').forEach(function (b) { b.textContent = n; b.hidden = !n; }); }

  /* ---------- overview ---------- */
  function renderOverview(o) {
    $('#kpis').innerHTML = kpi('Revenue', money(o.revenue), 'last ' + o.days + ' days' + (o.testMode ? ' · test mode' : ''), '#f7941d') + kpi('Orders', o.orders, 'avg ' + money(o.aov) + ' per order', '#d63a30') +
      kpi('Visitors', Number(o.visitors).toLocaleString(), Number(o.pageviews).toLocaleString() + ' pageviews', '#2592c9') + kpi('Conversion', o.conversion + '%', o.subscriptionsActive + ' active subs · ' + (o.emailSignups || 0) + ' emails', '#6a4fc9');
    $('#chartNote').textContent = 'Last ' + o.series.length + ' days';
    renderChart(o.series);
    var steps = [['Visitors', o.visitors], ['Added to bag', o.addToCart], ['Started checkout', o.checkoutStarts], ['Paid orders', o.orders]], max = Math.max(1, o.visitors);
    $('#funnel').innerHTML = steps.map(function (s) { return '<li><span>' + s[0] + '</span><div class="bar"><i style="width:' + Math.max(2, 100 * s[1] / max) + '%"></i></div><b>' + Number(s[1]).toLocaleString() + '</b></li>'; }).join('') +
      '<li><span>Quizzes taken</span><div class="bar"><i style="width:' + Math.max(2, Math.min(100, 100 * o.quizzes / max)) + '%;background:#6a4fc9"></i></div><b>' + o.quizzes + '</b></li>';
  }
  function renderToday() {
    var t0 = dayStart() / 1000, orders = (state.orders || []).filter(function (o) { return o.created >= t0; }), rev = orders.reduce(function (a, o) { return a + o.total; }, 0);
    var emails = (state.emails || []).filter(function (e) { return new Date(e.ts).getTime() >= dayStart(); }).length;
    var fresh = (state.creators || []).filter(function (c) { return c.status === 'new'; }).length;
    var carts = state.carts ? state.carts.sessions : 0;
    $('#today').innerHTML = tile('Today’s sales', money(rev), orders.length + (orders.length === 1 ? ' order' : ' orders'), true) + tile('Open carts', carts, state.carts ? money(state.carts.value) + ' parked' : '') + tile('New emails today', emails, (state.emails || []).length + ' total') + tile('Creator applications', fresh, fresh ? 'waiting for a reply' : 'all replied');
    badge('orders', orders.length); badge('people', fresh);
  }
  function renderAttention() {
    var items = [], fresh = (state.creators || []).filter(function (c) { return c.status === 'new'; }).length, cancel = (state.subs || []).filter(function (s) { return s.cancelAtPeriodEnd; }).length, past = (state.subs || []).filter(function (s) { return s.status === 'past_due' || s.status === 'unpaid'; }).length;
    if (fresh) items.push(['#c46a00', fresh + ' creator application' + (fresh > 1 ? 's' : '') + ' waiting for a reply', 'people', 'creators']);
    if (past) items.push(['#d63a30', past + ' subscription' + (past > 1 ? 's' : '') + ' with a failed payment', 'orders', 'subs']);
    if (cancel) items.push(['#6a4fc9', cancel + ' subscription' + (cancel > 1 ? 's' : '') + ' set to cancel at period end', 'orders', 'subs']);
    if (state.carts && state.carts.abandonedAfterCheckout) items.push(['#2592c9', state.carts.abandonedAfterCheckout + ' shopper' + (state.carts.abandonedAfterCheckout > 1 ? 's' : '') + ' reached checkout and left this week', 'carts']);
    $('#attention').innerHTML = items.length ? '<ul class="adm__alerts">' + items.map(function (i) { return '<li style="--c:' + i[0] + '"><i></i>' + esc(i[1]) + '<button type="button" data-go="' + i[2] + '"' + (i[3] ? ' data-sub2="' + i[3] + '"' : '') + '>Open →</button></li>'; }).join('') + '</ul>' : '<ul class="adm__alerts"><li class="ok"><i style="background:#2f9e63"></i>All clear. Nothing is waiting on you.</li></ul>';
  }
  function renderChart(series) {
    var W = 600, H = 200, pad = 26, n = series.length, maxR = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.revenue; }))), maxV = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.visitors; })));
    var bw = (W - pad * 2) / n, bars = series.map(function (s, i) { var h = (H - pad) * s.revenue / maxR; return '<rect x="' + (pad + i * bw + bw * .18) + '" y="' + (H - pad - h) + '" width="' + (bw * .64) + '" height="' + h + '" rx="3" fill="#f7941d"><title>' + s.day + ': ' + money(s.revenue) + ' · ' + s.orders + ' orders</title></rect>'; }).join('');
    var pts = series.map(function (s, i) { return (pad + i * bw + bw / 2) + ',' + (H - pad - (H - pad) * s.visitors / maxV); }).join(' ');
    var labels = series.filter(function (_, i) { return n <= 10 || i % Math.ceil(n / 6) === 0; }).map(function (s) { var i = series.indexOf(s); return '<text x="' + (pad + i * bw + bw / 2) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="#8a8a8a">' + s.day.slice(5) + '</text>'; }).join('');
    $('#chart').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-label="Daily revenue bars and visitor line">' + bars + '<polyline points="' + pts + '" fill="none" stroke="#2592c9" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' + labels + '</svg>' +
      '<div class="adm__legend"><span><i style="background:#f7941d"></i>Revenue (max ' + money(maxR) + ')</span><span><i style="background:#2592c9"></i>Visitors (max ' + maxV + ')</span></div>';
  }

  /* ---------- orders ---------- */
  function itemsText(items) { return items.map(function (i) { return i.qty + '× ' + esc(i.name); }).join(', '); }
  function stripeLink(o) { return 'https://dashboard.stripe.com/' + (o.livemode ? '' : 'test/') + 'search?query=' + encodeURIComponent(o.id); }
  function orderRow(o) {
    var open = state.open === o.id, s = o.shipping;
    return '<div class="adm__row adm__order" data-id="' + esc(o.id) + '" aria-expanded="' + open + '"><div><b>' + esc(o.name || o.email || '—') + '</b><small>' + when(o.created) + ' · ' + itemsText(o.items) + '</small></div><div class="num">' + money(o.total) + '</div>' +
      '<div class="meta"><span class="adm__tag adm__tag--' + (o.mode === 'subscription' ? 'subscription' : 'once') + '">' + o.mode + '</span><span class="adm__tag adm__tag--' + esc(o.status) + '">' + esc(o.status) + '</span>' + (s && s.state ? '<span class="adm__tag">' + esc(s.city ? s.city + ', ' : '') + esc(s.state) + '</span>' : '') + '<small>#' + esc(o.reference) + '</small></div>' +
      (open ? '<div class="adm__detail"><div><span>Items</span><ul>' + o.items.map(function (i) { return '<li><em>' + i.qty + '× ' + esc(i.name) + '</em><b>' + money(i.amount) + '</b></li>'; }).join('') + '</ul></div>' +
        '<div><span>Ship to</span><p>' + (s ? esc(o.name) + '<br>' + esc(s.line1 || '') + (s.line2 ? '<br>' + esc(s.line2) : '') + '<br>' + esc(s.city) + (s.state ? ', ' + esc(s.state) : '') + ' ' + esc(s.postal) : 'No address on the session') + '</p></div>' +
        '<div><span>Contact</span><p>' + esc(o.email) + (o.phone ? '<br>' + esc(o.phone) : '') + '</p></div><div><span>Reference</span><p>' + esc(o.reference) + '<br><a href="' + stripeLink(o) + '" target="_blank" rel="noopener">Open in Stripe →</a></p></div></div>' : '') + '</div>';
  }
  function renderOrders() {
    var q = ($('#orderSearch').value || '').toLowerCase(), t0 = dayStart() / 1000, f = state.filter;
    var list = (state.orders || []).filter(function (o) {
      if (q && (o.name + ' ' + o.email + ' ' + o.reference).toLowerCase().indexOf(q) === -1) return false;
      if (f === 'today') return o.created >= t0; if (f === 'one-time' || f === 'subscription') return o.mode === f; return true;
    });
    $('#ordersList').innerHTML = list.length ? list.map(orderRow).join('') : '<p class="adm__empty">' + (state.orders && state.orders.length ? 'Nothing matches that filter.' : 'No paid orders in this range yet.') + '</p>';
  }
  function renderLatest() { var l = (state.orders || []).slice(0, 5); $('#latestOrders').innerHTML = l.length ? '<div class="adm__list">' + l.map(function (o) { return '<div class="adm__row"><div><b>' + esc(o.name || o.email) + '</b><small>' + when(o.created) + ' · ' + itemsText(o.items) + '</small></div><div class="num">' + money(o.total) + '</div></div>'; }).join('') + '</div>' : '<p class="adm__empty">No orders yet.</p>'; }
  function renderSubs() {
    var s = state.subs || [], active = s.filter(function (x) { return x.status === 'active'; });
    $('#subsNote').textContent = active.length + ' active · ' + money(active.reduce(function (t, x) { return t + x.amount; }, 0)) + ' per month';
    $('#subsList').innerHTML = s.length ? s.map(function (x) { return '<div class="adm__row"><div><b>' + esc(x.name || x.email || '—') + '</b><small>' + esc(x.email) + ' · started ' + when(x.created) + '</small><small>' + itemsText(x.items) + ' · renews ' + whenIso(x.currentPeriodEnd * 1000) + (x.cancelAtPeriodEnd ? ' · cancels at period end' : '') + '</small></div><div class="num">' + money(x.amount) + '<small>per month</small></div><div class="meta"><span class="adm__tag adm__tag--' + esc(x.status) + '">' + esc(x.status) + '</span></div></div>'; }).join('') : '<p class="adm__empty">No subscriptions yet.</p>';
  }

  /* ---------- carts & analytics ---------- */
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

  /* ---------- people ---------- */
  function renderCreators() {
    var l = state.creators || [], fresh = l.filter(function (x) { return x.status === 'new'; }).length;
    $('#creatorsNote').textContent = l.length + ' application' + (l.length === 1 ? '' : 's') + ' · ' + fresh + ' new';
    $('#creatorsList').innerHTML = l.length ? l.map(function (x) { return '<div class="adm__row adm__creator" data-id="' + esc(x.id) + '"><div><div class="who"><b>' + esc(x.name) + '</b><small>' + esc(x.handle) + (x.platform ? ' · ' + esc(x.platform) : '') + (x.audience ? ' · ' + esc(x.audience) : '') + '</small></div><small><a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a>' + (x.website ? ' · <a href="' + esc(/^https?:/.test(x.website) ? x.website : 'https://' + x.website) + '" target="_blank" rel="noopener">' + esc(x.website) + '</a>' : '') + ' · ' + whenIso(x.ts) + '</small></div><select class="adm__status" data-status aria-label="Status">' + ['new', 'contacted', 'approved', 'declined'].map(function (s) { return '<option' + (s === x.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' + (x.message ? '<p class="adm__msg">' + esc(x.message) + '</p>' : '') + '</div>'; }).join('') : '<p class="adm__empty">No applications yet. Share docostrips.com/creators with creators.</p>';
  }
  $('#creatorsList').addEventListener('change', function (e) {
    var s = e.target.closest('[data-status]'); if (!s) return; var id = s.closest('[data-id]').dataset.id;
    api('creators/' + id, { method: 'POST', body: JSON.stringify({ status: s.value }) }).then(function () { (state.creators || []).forEach(function (c) { if (c.id === id) c.status = s.value; }); renderToday(); renderAttention(); $('#creatorsNote').textContent = state.creators.length + ' applications · ' + state.creators.filter(function (x) { return x.status === 'new'; }).length + ' new'; }).catch(function (ex) { alert(ex.message); });
  });
  function renderEmails() {
    var l = state.emails || []; $('#emailsNote').textContent = l.length + ' signup' + (l.length === 1 ? '' : 's') + (state.code ? ' · code ' + state.code : '');
    $('#emailsList').innerHTML = l.length ? l.map(function (x) { return '<div class="adm__row"><div><b>' + esc(x.email) + '</b><small>' + whenIso(x.ts) + ' · ' + esc(x.source || 'popup') + '</small></div><span class="adm__tag">' + esc(x.code || '') + '</span></div>'; }).join('') : '<p class="adm__empty">No signups yet. The welcome popup collects them on the home page.</p>';
  }
  api('session').then(function (s) { showApp(s.testMode); }).catch(showLogin);
})();
