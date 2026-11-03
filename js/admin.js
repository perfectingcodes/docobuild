/* DOCO admin dashboard — talks only to /api/admin/* on this origin. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (c) { return '$' + (Number(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var dayStart = function (d) { var x = d ? new Date(d) : new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); };
  var when = function (s) { var d = new Date(s * 1000), today = d.getTime() >= dayStart(); return (today ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  var whenIso = function (iso) { var d = new Date(iso); return d.getTime() >= dayStart() ? 'Today ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  var login = $('#admLogin'), app = $('#admApp'), form = $('#loginForm'), err = $('#loginErr'), daysSel = $('#admDays');
  var TITLES = { overview: 'Overview', orders: 'Orders', carts: 'Carts', analytics: 'Insights', people: 'People', social: 'Social', email: 'Email', design: 'Design' };
  var STUDIO = { social: 1, email: 1, design: 1 };
  var state = { tab: 'overview', sub: { orders: 'orders', people: 'creators', email: 'automations' }, days: 30, filter: 'all', open: null, orders: null, subs: null, creators: null, emails: null, carts: null, testMode: false,
    social: { posts: [], filter: 'upcoming', platforms: [], statuses: [], editing: null }, email: null, settings: null };

  function api(path, opts) {
    return fetch('/api/admin/' + path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {})).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('Signed out'); }
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Request failed'); return d; });
    });
  }
  var toastT; function toast(msg, bad) { var t = $('#admToast'); t.textContent = msg; t.classList.toggle('is-err', !!bad); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2800); }
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
  $('#admMoreBtn').addEventListener('click', function () { $('#admMore').hidden = false; });
  app.addEventListener('click', function (e) {
    if (e.target.closest('[data-more-close]')) { $('#admMore').hidden = true; return; }
    var t = e.target.closest('[data-tab],[data-go],[data-sub],[data-filter],.adm__order');
    if (!t) return;
    if (t.dataset.tab) { $('#admMore').hidden = true; return go(t.dataset.tab); }
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
    $('#admMoreBtn').classList.toggle('is-on', !!{ carts: 1, analytics: 1, people: 1, design: 1 }[tab]);
    $$('.adm__panel').forEach(function (p) { p.hidden = p.dataset.panel !== tab; });
    $('#pTitle').textContent = TITLES[tab] || tab;
    $('.adm__main').classList.toggle('is-studio', !!STUDIO[tab]);
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
      api('emails').then(function (r) { state.emails = r.emails || []; state.code = r.code; renderEmails(); }).catch(note('#emailsList')),
      api('social').then(function (r) { state.social.posts = r.posts || []; state.social.platforms = r.platforms || []; state.social.statuses = r.statuses || []; renderSocial(); }).catch(note('#socialList')),
      api('email').then(function (r) { state.email = r; renderEmailPortal(); }).catch(note('#autoList')),
      api('settings').then(function (r) { state.settings = r.settings; renderDesign(); fillSender(); }).catch(note('#driveCard'))
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
    var dueToday = state.social.posts.filter(function (p) { var t = new Date(p.scheduledAt).getTime(); return t >= dayStart() && t < dayStart() + 86400000 && p.status !== 'posted' && p.status !== 'skipped'; }).length;
    badge('social', dueToday);
    badge('email', state.email && !state.email.connected ? '!' : 0);
  }
  function renderAttention() {
    var items = [], fresh = (state.creators || []).filter(function (c) { return c.status === 'new'; }).length, cancel = (state.subs || []).filter(function (s) { return s.cancelAtPeriodEnd; }).length, past = (state.subs || []).filter(function (s) { return s.status === 'past_due' || s.status === 'unpaid'; }).length;
    var due = state.social.posts.filter(function (p) { var t = new Date(p.scheduledAt).getTime(); return t < dayStart() + 86400000 && p.status !== 'posted' && p.status !== 'skipped'; }).length;
    if (fresh) items.push(['#c46a00', fresh + ' creator application' + (fresh > 1 ? 's' : '') + ' waiting for a reply', 'people', 'creators']);
    if (past) items.push(['#d63a30', past + ' subscription' + (past > 1 ? 's' : '') + ' with a failed payment', 'orders', 'subs']);
    if (cancel) items.push(['#6a4fc9', cancel + ' subscription' + (cancel > 1 ? 's' : '') + ' set to cancel at period end', 'orders', 'subs']);
    if (due) items.push(['#f7941d', due + ' social post' + (due > 1 ? 's' : '') + ' due today or overdue', 'social']);
    if (state.email && !state.email.connected) items.push(['#ffd23e', 'Email automations are not connected yet', 'email', 'automations']);
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
    api('creators/' + id, { method: 'POST', body: JSON.stringify({ status: s.value }) }).then(function () { (state.creators || []).forEach(function (c) { if (c.id === id) c.status = s.value; }); renderToday(); renderAttention(); $('#creatorsNote').textContent = state.creators.length + ' applications · ' + state.creators.filter(function (x) { return x.status === 'new'; }).length + ' new'; if (s.value === 'approved') toast('Approved. The welcome email goes out if email is connected.'); }).catch(function (ex) { toast(ex.message, true); });
  });
  function renderEmails() {
    var l = state.emails || []; $('#emailsNote').textContent = l.length + ' signup' + (l.length === 1 ? '' : 's') + (state.code ? ' · code ' + state.code : '');
    $('#emailsList').innerHTML = l.length ? l.map(function (x) { return '<div class="adm__row"><div><b>' + esc(x.email) + '</b><small>' + whenIso(x.ts) + ' · ' + esc(x.source || 'popup') + '</small></div><span class="adm__tag">' + esc(x.code || '') + '</span></div>'; }).join('') : '<p class="adm__empty">No signups yet. The welcome popup collects them on the home page.</p>';
  }

  /* ---------- social schedule ---------- */
  var PCOLOR = { Instagram: '#d63a30', TikTok: '#111', YouTube: '#c4302b', Facebook: '#2592c9', X: '#111', Pinterest: '#bd081c', Email: '#f7941d', Other: '#6a4fc9' };
  function dayLabel(d) { var t0 = dayStart(), t = dayStart(d), diff = Math.round((t - t0) / 86400000); if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday'; return new Date(d).toLocaleDateString('en-US', { weekday: 'long' }); }
  function toLocalInput(iso) { var d = iso ? new Date(iso) : new Date(Date.now() + 3600000); d.setSeconds(0, 0); var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function renderSocial() {
    var posts = state.social.posts.slice().sort(function (a, b) { return new Date(a.scheduledAt) - new Date(b.scheduledAt); }), f = state.social.filter, t0 = dayStart(), wk = t0 + 7 * 86400000;
    var live = function (p) { return p.status !== 'posted' && p.status !== 'skipped'; };
    var week = posts.filter(function (p) { var t = new Date(p.scheduledAt).getTime(); return t >= t0 && t < wk && live(p); }).length;
    var scheduled = posts.filter(function (p) { return live(p) && new Date(p.scheduledAt).getTime() >= t0; }).length;
    var posted30 = posts.filter(function (p) { return p.status === 'posted' && new Date(p.postedAt || p.scheduledAt).getTime() >= t0 - 30 * 86400000; }).length;
    var overdue = posts.filter(function (p) { return live(p) && new Date(p.scheduledAt).getTime() < t0; }).length;
    $('#socialStats').innerHTML = tile('This week', week, week === 1 ? 'post planned' : 'posts planned', true) + tile('Queued', scheduled, 'from today on') + tile('Posted', posted30, 'last 30 days') + tile('Overdue', overdue, overdue ? 'move or mark posted' : 'nothing slipped');
    var list = posts.filter(function (p) { if (f === 'all') return true; if (f === 'posted') return p.status === 'posted'; return live(p); });
    if (f === 'posted') list.reverse();
    var groups = []; list.forEach(function (p) { var k = dayStart(p.scheduledAt); var g = groups[groups.length - 1]; if (!g || g.k !== k) { g = { k: k, d: p.scheduledAt, items: [] }; groups.push(g); } g.items.push(p); });
    $('#socialList').innerHTML = groups.length ? groups.map(function (g) {
      var isToday = g.k === t0, late = g.k < t0;
      return '<div class="adm__day"><div class="adm__dayk' + (isToday ? ' is-today' : '') + '">' + dayLabel(g.d) + '<small>' + new Date(g.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (late && f !== 'posted' ? ' · overdue' : '') + '</small></div>' +
        g.items.map(function (p) { return '<div class="adm__post' + (p.status === 'posted' ? ' is-posted' : '') + '" style="--c:' + (PCOLOR[p.platform] || '#6a4fc9') + '" data-id="' + esc(p.id) + '"><time>' + new Date(p.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</time><div><b>' + esc(p.title) + '</b>' + (p.caption ? '<p>' + esc(p.caption) + '</p>' : '') + '</div>' +
          '<div class="acts"><select class="adm__status" data-pstatus aria-label="Status">' + state.social.statuses.map(function (s) { return '<option' + (s === p.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select><button type="button" data-pedit>Edit</button></div>' +
          '<div class="meta"><span class="adm__plat">' + esc(p.platform) + '</span>' + (p.link ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener">Asset ↗</a>' : '') + (p.notes ? '<small>' + esc(p.notes) + '</small>' : '') + '</div></div>'; }).join('') + '</div>';
    }).join('') : '<p class="adm__empty">' + (f === 'posted' ? 'Nothing marked posted yet.' : 'Nothing scheduled. Add your first post.') + '</p>';
  }
  var sf = $('#socialForm');
  function openSocialForm(p) {
    state.social.editing = p ? p.id : null;
    $('#socialFormTitle').textContent = p ? 'Edit post' : 'New post';
    sf.platform.innerHTML = state.social.platforms.map(function (x) { return '<option>' + x + '</option>'; }).join('');
    sf.status.innerHTML = state.social.statuses.map(function (x) { return '<option>' + x + '</option>'; }).join('');
    sf.platform.value = p ? p.platform : 'Instagram'; sf.status.value = p ? p.status : 'planned';
    sf.scheduledAt.value = toLocalInput(p && p.scheduledAt); sf.title.value = p ? p.title : ''; sf.caption.value = p ? p.caption || '' : ''; sf.link.value = p ? p.link || '' : ''; sf.notes.value = p ? p.notes || '' : '';
    $('[data-social-delete]', sf).hidden = !p; $('#socialErr').hidden = true; countCaption();
    sf.hidden = false; sf.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(function () { sf.title.focus(); }, 300);
  }
  function countCaption() { $('#captionCount').textContent = sf.caption.value.length + ' / 2200'; }
  sf.caption.addEventListener('input', countCaption);
  $('#socialNew').addEventListener('click', function () { openSocialForm(null); });
  sf.addEventListener('click', function (e) {
    if (e.target.closest('[data-social-cancel]')) { sf.hidden = true; return; }
    if (e.target.closest('[data-social-delete]') && state.social.editing) {
      if (!confirm('Delete this post from the schedule?')) return;
      api('social/' + state.social.editing, { method: 'DELETE' }).then(function () { sf.hidden = true; return reloadSocial('Post deleted'); }).catch(function (ex) { toast(ex.message, true); });
    }
  });
  sf.addEventListener('submit', function (e) {
    e.preventDefault(); $('#socialErr').hidden = true;
    var when_ = new Date(sf.scheduledAt.value);
    var body = { platform: sf.platform.value, status: sf.status.value, scheduledAt: isNaN(when_) ? '' : when_.toISOString(), title: sf.title.value.trim(), caption: sf.caption.value, link: sf.link.value.trim(), notes: sf.notes.value.trim() };
    api('social' + (state.social.editing ? '/' + state.social.editing : ''), { method: 'POST', body: JSON.stringify(body) })
      .then(function () { sf.hidden = true; return reloadSocial(state.social.editing ? 'Post updated' : 'Post added to the schedule'); })
      .catch(function (ex) { $('#socialErr').textContent = ex.message; $('#socialErr').hidden = false; });
  });
  function reloadSocial(msg) { return api('social').then(function (r) { state.social.posts = r.posts || []; renderSocial(); renderToday(); renderAttention(); if (msg) toast(msg); }); }
  $('#socialChips').addEventListener('click', function (e) { var b = e.target.closest('[data-sfilter]'); if (!b) return; state.social.filter = b.dataset.sfilter; $$('#socialChips button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); renderSocial(); });
  $('#socialList').addEventListener('click', function (e) { var b = e.target.closest('[data-pedit]'); if (!b) return; var id = b.closest('[data-id]').dataset.id; var p = state.social.posts.filter(function (x) { return x.id === id; })[0]; if (p) openSocialForm(p); });
  $('#socialList').addEventListener('change', function (e) {
    var s = e.target.closest('[data-pstatus]'); if (!s) return; var id = s.closest('[data-id]').dataset.id;
    api('social/' + id, { method: 'POST', body: JSON.stringify({ status: s.value }) }).then(function () { return reloadSocial(s.value === 'posted' ? 'Marked as posted' : 'Status updated'); }).catch(function (ex) { toast(ex.message, true); });
  });

  /* ---------- email portal ---------- */
  function renderEmailPortal() {
    var E = state.email; if (!E) return;
    var ok = E.connected && E.sender;
    $('#emailStatus').innerHTML = '<div class="adm__connect' + (ok ? ' is-ok' : '') + '"><span class="dot"></span><div><b>' + (ok ? 'Connected · sending as ' + esc(E.sender) : E.connected ? 'Resend is connected — add a sender to start' : 'Email automations are not connected yet') + '</b><small>' + (ok ? 'Confirmations, welcome codes, creator replies and reminders go out automatically. ' + (E.counts.sent || 0) + ' sent in the last 30 days.' : 'Nothing sends until Resend is connected and a verified From address is set. Everything below is ready and waiting.') + '</small></div>' +
      (ok ? '<button type="button" class="adm__btn" data-go="email" data-sub2="activity">Activity</button>' : '<button type="button" class="adm__btn" data-go="email" data-sub2="sender">Set sender</button>') +
      (!E.connected ? '<ol class="adm__steps"><li>Create a free account at resend.com and add the domain <code>docostrips.com</code>. Resend shows DNS records; add them where the domain is managed and wait for the green check.</li><li>In Resend, create an API key. In Replit, open <strong>Secrets</strong> and add it as <code>RESEND_API_KEY</code>, then restart the app.</li><li>Come back here, open <strong>Sender &amp; timing</strong>, set the From email on that domain, and send yourself a test.</li></ol>' : '') + '</div>';
    var kinds = Object.keys(E.kinds);
    $('#autoList').innerHTML = kinds.map(function (k) {
      var t = E.templates[k], info = E.kinds[k];
      return '<div class="adm__auto' + (t.enabled ? '' : ' is-off') + '" data-kind="' + k + '"><div class="adm__auto-head"><label class="adm__switch' + (t.enabled ? ' is-on' : '') + '" title="On / off"><input type="checkbox" data-toggle' + (t.enabled ? ' checked' : '') + '><i></i></label><div><b>' + esc(info.name) + (t.custom ? ' <span class="adm__tag">edited</span>' : '') + '</b><small>' + esc(info.trigger) + '</small></div><button type="button" class="adm__link" data-edit>Edit</button></div>' +
        '<div class="adm__auto-body adm__form"><label>Subject<input data-subject value="' + esc(t.subject) + '" maxlength="200"></label><label>Message<textarea data-body rows="9" maxlength="12000">' + esc(t.body) + '</textarea></label>' +
        '<div class="adm__vars"><small class="adm__hint" style="margin:0 6px 0 0">Insert:</small>' + info.vars.map(function (v) { return '<button type="button" data-var="' + v + '">{{' + v + '}}</button>'; }).join('') + '</div>' +
        '<p class="adm__hint">Use **two stars** for bold. Blank lines start a new paragraph. Links become clickable.</p>' +
        '<div class="adm__factions"><button type="button" class="adm__btn adm__btn--solid" data-save>Save</button><button type="button" class="adm__btn" data-preview>Preview</button>' + (t.custom ? '<button type="button" class="adm__link" data-reset>Reset to default</button>' : '') + '</div>' +
        '<div class="adm__testrow"><input type="email" placeholder="you@docostrips.com" data-testto aria-label="Send a test to"><button type="button" class="adm__btn" data-test' + (ok ? '' : ' disabled') + '>Send test</button></div>' +
        '<div class="adm__preview" data-previewbox hidden></div></div></div>';
    }).join('');
    var cnt = E.counts || {};
    $('#logNote').textContent = (cnt.sent || 0) + ' sent · ' + (cnt.failed || 0) + ' failed · ' + (cnt.skipped || 0) + ' skipped in the last 30 days';
    $('#emailLog').innerHTML = E.log.length ? E.log.map(function (l) { return '<div class="adm__row adm__log"><div><b>' + esc(E.kinds[l.kind] ? E.kinds[l.kind].name : l.kind) + '</b><small>' + esc(l.to) + ' · ' + whenIso(l.ts) + (l.subject ? ' · ' + esc(l.subject) : '') + '</small>' + (l.error ? '<small class="err">' + esc(l.error) + '</small>' : '') + '</div><span class="adm__tag adm__tag--' + esc(l.status) + '">' + esc(l.status) + '</span></div>'; }).join('') : '<p class="adm__empty">No email activity yet.</p>';
  }
  function fillSender() {
    var s = state.settings; if (!s) return; var f = $('#senderForm');
    f.fromName.value = s.email.fromName || ''; f.fromEmail.value = s.email.fromEmail || ''; f.replyTo.value = s.email.replyTo || '';
    f.renewalDays.value = s.reminders.renewalDays; f.reorderDays.value = s.reminders.reorderDays;
  }
  $('#senderForm').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target; $('#senderErr').hidden = true;
    api('settings', { method: 'POST', body: JSON.stringify({ email: { fromName: f.fromName.value, fromEmail: f.fromEmail.value, replyTo: f.replyTo.value }, reminders: { renewalDays: f.renewalDays.value, reorderDays: f.reorderDays.value } }) })
      .then(function (r) { state.settings = r.settings; toast('Sender saved'); return api('email'); }).then(function (r) { state.email = r; renderEmailPortal(); renderToday(); renderAttention(); })
      .catch(function (ex) { $('#senderErr').textContent = ex.message; $('#senderErr').hidden = false; });
  });
  $('#runReminders').addEventListener('click', function () {
    var b = this; b.disabled = true; b.textContent = 'Checking…';
    api('email/run-reminders', { method: 'POST' }).then(function (r) { toast('Checked ' + r.checked + ' · sent ' + r.renewal + ' renewal, ' + r.reorder + ' restock' + (r.error ? ' · ' + r.error : '')); return api('email'); }).then(function (r) { state.email = r; renderEmailPortal(); })
      .catch(function (ex) { toast(ex.message, true); }).then(function () { b.disabled = false; b.textContent = 'Run reminders now'; });
  });
  $('#autoList').addEventListener('change', function (e) {
    var t = e.target.closest('[data-toggle]'); if (!t) return; var card = t.closest('.adm__auto'), kind = card.dataset.kind;
    api('email/templates/' + kind, { method: 'POST', body: JSON.stringify({ enabled: t.checked }) }).then(function () { card.classList.toggle('is-off', !t.checked); t.closest('.adm__switch').classList.toggle('is-on', t.checked); state.email.templates[kind].enabled = t.checked; toast(t.checked ? 'Automation on' : 'Automation off'); }).catch(function (ex) { t.checked = !t.checked; toast(ex.message, true); });
  });
  $('#autoList').addEventListener('click', function (e) {
    var card = e.target.closest('.adm__auto'); if (!card) return; var kind = card.dataset.kind, subj = $('[data-subject]', card), body = $('[data-body]', card);
    if (e.target.closest('[data-edit]')) { card.classList.toggle('is-open'); e.target.closest('[data-edit]').textContent = card.classList.contains('is-open') ? 'Close' : 'Edit'; return; }
    var v = e.target.closest('[data-var]'); if (v) { var tag = '{{' + v.dataset.var + '}}', s = body.selectionStart || body.value.length; body.value = body.value.slice(0, s) + tag + body.value.slice(s); body.focus(); body.selectionStart = body.selectionEnd = s + tag.length; return; }
    if (e.target.closest('[data-save]')) {
      api('email/templates/' + kind, { method: 'POST', body: JSON.stringify({ subject: subj.value, body: body.value }) }).then(function () { toast('Saved'); return api('email'); }).then(function (r) { state.email = r; renderEmailPortal(); $('.adm__auto[data-kind="' + kind + '"]').classList.add('is-open'); }).catch(function (ex) { toast(ex.message, true); }); return;
    }
    if (e.target.closest('[data-reset]')) {
      if (!confirm('Put the default wording back?')) return;
      api('email/templates/' + kind, { method: 'POST', body: JSON.stringify({ reset: true }) }).then(function () { toast('Default restored'); return api('email'); }).then(function (r) { state.email = r; renderEmailPortal(); }).catch(function (ex) { toast(ex.message, true); }); return;
    }
    if (e.target.closest('[data-preview]')) {
      var box = $('[data-previewbox]', card);
      api('email/preview', { method: 'POST', body: JSON.stringify({ subject: subj.value, body: body.value }) }).then(function (m) { box.innerHTML = '<p class="adm__hint" style="margin:0 0 10px"><strong>Subject:</strong> ' + esc(m.subject) + '</p>' + m.html.replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, ''); box.hidden = false; }).catch(function (ex) { toast(ex.message, true); }); return;
    }
    if (e.target.closest('[data-test]')) {
      var to = $('[data-testto]', card).value.trim(); if (!to) { toast('Enter an address to send the test to', true); return; }
      var btn = e.target.closest('[data-test]'); btn.disabled = true;
      api('email/test', { method: 'POST', body: JSON.stringify({ kind: kind, to: to, subject: subj.value, body: body.value }) }).then(function () { toast('Test sent to ' + to); }).catch(function (ex) { toast(ex.message, true); }).then(function () { btn.disabled = false; });
    }
  });

  /* ---------- design access ---------- */
  function renderDesign() {
    var s = state.settings; if (!s) return;
    var ic = '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>';
    $('#driveCard').innerHTML = (s.driveUrl ? '<div class="adm__drive"><div><b>Brand drive</b><small>Logos, pattern files, product renders, packaging photos and every graphic for the site. Opens in Google Drive.</small></div><a class="adm__btn" href="' + esc(s.driveUrl) + '" target="_blank" rel="noopener">Open the drive ↗</a></div>'
      : '<div class="adm__drive adm__drive--empty"><div><b>Add the brand drive</b><small>Paste the Google Drive folder link below so everyone on the team can open the graphics from here.</small></div></div>') +
      (s.designLinks.length ? '<div class="adm__quick" style="margin-top:12px">' + s.designLinks.map(function (l) { return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + ic + '<span>' + esc(l.label) + '</span></a>'; }).join('') + '</div>' : '');
    var f = $('#designForm'); f.driveUrl.value = s.driveUrl || '';
    $('#designLinks').innerHTML = s.designLinks.map(linkRow).join('');
  }
  function linkRow(l) { return '<div class="adm__linkrow"><input placeholder="Label (Canva, Figma, fonts…)" value="' + esc(l ? l.label : '') + '" data-llabel maxlength="60"><input type="url" placeholder="https://…" value="' + esc(l ? l.url : '') + '" data-lurl><button type="button" data-lremove aria-label="Remove">✕</button></div>'; }
  $('#designAdd').addEventListener('click', function () { $('#designLinks').insertAdjacentHTML('beforeend', linkRow(null)); var rows = $$('.adm__linkrow'); $('[data-llabel]', rows[rows.length - 1]).focus(); });
  $('#designLinks').addEventListener('click', function (e) { var b = e.target.closest('[data-lremove]'); if (b) b.closest('.adm__linkrow').remove(); });
  $('#designForm').addEventListener('submit', function (e) {
    e.preventDefault(); $('#designErr').hidden = true;
    var links = $$('.adm__linkrow').map(function (r) { return { label: $('[data-llabel]', r).value.trim(), url: $('[data-lurl]', r).value.trim() }; }).filter(function (l) { return l.url; });
    api('settings', { method: 'POST', body: JSON.stringify({ driveUrl: e.target.driveUrl.value.trim(), designLinks: links }) })
      .then(function (r) { state.settings = r.settings; renderDesign(); toast('Design links saved'); })
      .catch(function (ex) { $('#designErr').textContent = ex.message; $('#designErr').hidden = false; });
  });

  api('session').then(function (s) { showApp(s.testMode); }).catch(showLogin);
})();
