/* ============================================================
   DOCO — shared site engine (home · shop · product)
   catalog · overlays (bag / checkout / quiz / toast) · header
   showcase (scroll-pinned + pointer tilt) · product grid · PDP
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return '$' + n.toFixed(2); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COMMERCE_ENABLED = false;
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  /* ---------- type preview switcher: ?font=bricolage|unbounded|syne|space|anton (sticks for the session; ?font=default clears) ---------- */
  (function () {
    var FONTS = { unbounded: 'Unbounded:wght@700;800', syne: 'Syne:wght@700;800', space: 'Space+Grotesk:wght@700', anton: 'Anton' };
    var q = new URLSearchParams(location.search).get('font'), f;
    try { if (q) { if (q === 'default' || q === 'bricolage') localStorage.removeItem('doco_font'); else localStorage.setItem('doco_font', q); } f = localStorage.getItem('doco_font'); } catch (_) { f = q; }
    if (!f || !FONTS[f]) return;
    document.documentElement.dataset.font = f;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + FONTS[f] + '&display=swap'; document.head.appendChild(l);
  })();

  /* ---------- catalog ---------- */
  var P = {
    multi: { kind: 'formula', name: 'Multivitamin', eyebrow: 'The daily foundation', tag: 'From someday to every day.', flavor: 'Cranberry', price: 29.99, sub: 25.49, color: '#ef8120', img: 'assets/multivitamin.jpg', pouch: 'assets/pouch-multi.webp',
      desc: 'Ten nutrients that support everyday body functions in one portable strip. The vitamin habit you can actually keep.',
      pills: ['10 nutrients', '30 strips', 'Cranberry'], callouts: ['10 nutrients', 'D3 800 IU', 'B12 1,500 mcg'],
      benefits: ['B5, B6 and biotin help your body use nutrients from food', 'B12 supports normal nerve function and red blood cell formation', 'D3 and K2 support bone health; vitamin A supports vision and immune function'],
      ingredients: [['Vitamin A', '900 mcg', 'Supports normal vision and immune function'], ['Vitamin D3', '800 IU', 'Helps calcium absorption'], ['Vitamin K2', '120 mcg', 'Supports normal bone health'], ['Vitamin B5', '5 mg', 'Energy metabolism'], ['Vitamin B6', '2 mg', 'Energy metabolism'], ['Biotin', '300 mcg', 'Energy metabolism'], ['Folate', '400 mcg', 'Supports DNA formation'], ['Vitamin B12', '1,500 mcg', 'Nerve function and red blood cell formation'], ['Iodine', '150 mcg', 'Helps make thyroid hormones'], ['Manganese', '2 mg', 'Cellular support']], other: 'Pullulan, cellulose, natural cranberry flavor, lecithin, mannitol, sorbitol syrup, erythritol, steviol glycosides.', chooseIf: 'you want an easy-to-carry vitamin habit with nutrients that support everyday functions.', strips: 30,
      inside: 'A daily blend of essential vitamins and minerals in a fast-dissolving oral strip. Cranberry flavored. The full panel is printed on every box.',
      gallery: ['assets/multivitamin.jpg', 'assets/hero-lifestyle.jpg', 'assets/crew-mockup.jpg'] },
    sport: { kind: 'formula', name: 'Sports Energy', eyebrow: 'Fuel the grind', tag: 'Energy now. No crash later.', flavor: 'Strawberry + mint', price: 29.99, sub: 25.49, color: '#d63a30', img: 'assets/sports-energy.jpg', pouch: 'assets/pouch-sport.webp',
      desc: 'A labeled 80 mg of natural caffeine with L-theanine and B12 — a measured option for the gym, the office, the next move. No drink to carry.',
      pills: ['80 mg caffeine', 'L-theanine', 'Strawberry-mint'], callouts: ['80 mg caffeine', 'L-theanine 30 mg', 'Vitamin B12'],
      benefits: ['A labeled 80 mg of natural caffeine for alertness — you know the amount you’re choosing', 'L-theanine 30 mg included alongside the caffeine', 'Vitamin B12 1,500 mcg supports normal nerves and red blood cells'],
      ingredients: [['Natural caffeine', '80 mg', 'The formula’s stimulant for alertness'], ['L-theanine', '30 mg', 'A tea-associated amino acid included alongside caffeine'], ['Vitamin B12', '1,500 mcg', 'Supports normal nerves and red blood cells — not a stimulant']], other: 'Pullulan, cellulose, mannitol, monk fruit extract, erythritol, natural strawberry flavor, sunflower lecithin, menthol crystals, spearmint flavor, peppermint flavor, steviol glycosides.', chooseIf: 'you want a portable caffeine option for your active-day routine.', strips: 30,
      inside: 'Caffeine paired with L-Theanine for smooth, focused energy, in a strawberry + mint strip. Take 15–20 minutes before you need it.',
      gallery: ['assets/sports-energy.jpg', 'assets/pair-domore.jpg', 'assets/hero-lifestyle.jpg'] },
    calm: { kind: 'formula', name: 'Calm + Stress', eyebrow: 'Clarity on demand', tag: 'From chaos to calm.', flavor: 'Lemon', price: 29.99, sub: 25.49, color: '#2592c9', img: 'assets/calm-stress.jpg', pouch: 'assets/pouch-calm.webp',
      desc: 'SunTheanine® L-theanine with holy basil, passionflower and lemon balm in a lemon strip — your cue to step away, breathe, and reset.',
      pills: ['L-theanine 50 mg', '6 botanicals', 'Lemon'], callouts: ['L-theanine 50 mg', 'Holy basil 30 mg', 'Lemon flavor'],
      benefits: ['SunTheanine® L-theanine 50 mg — an amino acid studied for relaxation', 'Holy basil, passionflower and lemon balm, traditionally used in calming routines', 'Ashwagandha and chamomile — botanicals used in stress and relaxation routines'],
      ingredients: [['SunTheanine® L-theanine', '50 mg', 'An amino acid studied for relaxation'], ['Holy basil', '30 mg', 'Traditionally used in stress-management routines'], ['Passionflower', '20 mg', 'Traditionally used in relaxation routines'], ['Lemon balm', '10 mg', 'Often included in calming blends'], ['Ashwagandha', '5 mg', 'Used in stress and relaxation routines'], ['Chamomile', '5 mg', 'Used in stress and relaxation routines']], other: 'Pullulan, cellulose, monk fruit extract, medium-chain triglycerides, pectin, natural lemon flavor, sunflower lecithin, steviol glycosides.', chooseIf: 'you want a portable addition to your pause-and-reset ritual.', strips: 30,
      inside: 'Ashwagandha and calming botanicals in a lemon-flavored strip. Non-drowsy — built for the middle of a busy day.',
      gallery: ['assets/calm-stress.jpg', 'assets/pair-relax.jpg', 'assets/hero-lifestyle.jpg'] },
    sleep: { kind: 'formula', name: 'Sleep', eyebrow: 'Recover to win', tag: 'From restless to rested.', flavor: 'Cranberry', price: 29.99, sub: 25.49, color: '#6a4fc9', img: 'assets/sleep.jpg', pouch: 'assets/pouch-sleep.webp',
      desc: 'Tart cherry, saffron and B6 in a cranberry strip — your cue to set the phone aside, lower the lights and begin the wind-down. No added melatonin.',
      pills: ['Tart cherry', 'Saffron', 'No melatonin'], callouts: ['Tart cherry 50 mg', 'Saffron 14 mg', 'No melatonin'],
      benefits: ['Tart cherry 50 mg — a source of plant compounds studied in sleep research', 'Saffron 14 mg — studied for sleep quality in standardized extracts', 'Vitamin B6 1.4 mg supports normal nervous system function — no added melatonin'],
      ingredients: [['Tart cherry', '50 mg', 'A source of plant compounds; studied in sleep research'], ['Saffron', '14 mg', 'Studied for sleep quality in certain standardized extracts'], ['Vitamin B6', '1.4 mg', 'Supports normal nervous system function and neurotransmitter production']], other: 'Pullulan, cellulose, mannitol, sunflower lecithin, pectin, natural cranberry flavor, steviol glycosides.', chooseIf: 'you want to make winding down a more intentional part of your day.', strips: 30, note: 'No added melatonin in the formula.',
      inside: 'A gentle nighttime blend in a cranberry strip. Take it about 30 minutes before bed — no water needed.',
      gallery: ['assets/sleep.jpg', 'assets/pair-relax.jpg', 'assets/crew-mockup.jpg'] },
    'duo-domore': { kind: 'bundle', includes: ['multi', 'sport'], name: 'The Do More Duo', eyebrow: 'Perfect pair', tag: 'Daily nutrients plus clean energy.', strips: 60, price: 44.99, sub: 38.24, color: '#ef8120', img: 'assets/pair-domore.jpg',
      desc: 'Multivitamin for the baseline, Sports Energy for the push. The combo for getting after it.',
      pills: ['Multivitamin', 'Sports Energy', 'Save $15'], benefits: ['Your daily foundation plus a clean lift', 'Two formulas, one simple routine', 'Save $15 vs. buying separately'],
      inside: 'One box of Multivitamin (cranberry) and one box of Sports Energy (strawberry + mint).', gallery: ['assets/pair-domore.jpg', 'assets/multivitamin.jpg', 'assets/sports-energy.jpg'] },
    'duo-relax': { kind: 'bundle', includes: ['calm', 'sleep'], name: 'The Relaxation Duo', eyebrow: 'Perfect pair', tag: 'Calm for the day, deep rest for the night.', strips: 60, price: 44.99, sub: 38.24, color: '#2592c9', img: 'assets/pair-relax.jpg',
      desc: 'Calm + Stress to stay composed, Sleep to recover fully. Wind down and come back stronger.',
      pills: ['Calm + Stress', 'Sleep', 'Save $15'], benefits: ['Composure by day, recovery by night', 'Two formulas, one simple routine', 'Save $15 vs. buying separately'],
      inside: 'One box of Calm + Stress (lemon) and one box of Sleep (cranberry).', gallery: ['assets/pair-relax.jpg', 'assets/calm-stress.jpg', 'assets/sleep.jpg'] },
    stack: { kind: 'bundle', includes: ['multi', 'sport', 'calm', 'sleep'], name: 'The Variety Pack', eyebrow: 'Best value', tag: 'All four formulas. Every part of your day.', strips: 120, price: 79.99, sub: 71.99, color: '#17130d', img: 'assets/crew-mockup.jpg',
      desc: 'The fastest way to find your favorites and cover every part of your day — energy, focus, calm and sleep.',
      pills: ['4 formulas', 'Save 33%', 'Free shipping'], benefits: ['All four formulas in one box', 'Save 33% vs. buying separately', 'Free shipping, always'],
      inside: 'One box each of Multivitamin, Sports Energy, Calm + Stress and Sleep.', gallery: ['assets/crew-mockup.jpg', 'assets/hero-lifestyle.jpg', 'assets/pair-domore.jpg'] }
  };
  var ORDER = ['multi', 'sport', 'calm', 'sleep', 'duo-domore', 'duo-relax', 'stack'];
  var FREE_SHIP = 45, SHIP_FEE = 5.99;

  /* ---------- overlays (injected so every page has them) ---------- */
  document.body.insertAdjacentHTML('beforeend',
    '<div class="bag-scrim" id="bagScrim" hidden></div>' +
    '<aside class="bag" id="bag" aria-hidden="true" aria-label="Your bag">' +
      '<div class="bag__head"><h3>Your bag <span class="bag__count" id="bagCount">0</span></h3><button type="button" class="bag__close" data-bag-close aria-label="Close bag">&times;</button></div>' +
      '<div class="bag__ship"><div class="bag__shipbar"><i id="shipBar"></i></div><p id="shipMsg"></p></div>' +
      '<div class="bag__items" id="bagItems"></div>' +
      '<div class="bag__foot"><div class="bag__row"><span>Subtotal</span><b id="bagSub">$0.00</b></div>' +
      '<p class="bag__note">Shipping &amp; taxes calculated at checkout. Subscriptions ship monthly &mdash; cancel anytime.</p>' +
      '<button type="button" class="btn btn--solid btn--block btn--lg" id="checkoutBtn">Checkout <span class="arr">&rarr;</span></button>' +
      '<button type="button" class="btn btn--text btn--block" data-bag-close>Continue shopping</button></div></aside>' +
    '<div class="modal" id="checkout" aria-hidden="true" role="dialog" aria-label="Checkout"><div class="modal__scrim"></div><div class="modal__panel modal__panel--wide">' +
      '<button type="button" class="modal__close" data-modal-close aria-label="Close">&times;</button>' +
      '<div class="co" id="coBody"><form class="co__form" id="coForm" novalidate><p class="eyebrow">Checkout</p><h3 class="co__title">Almost there.</h3><p class="co__demo">Demo checkout &mdash; no payment is taken.</p>' +
      '<div class="field"><label for="coName">Full name</label><input id="coName" required autocomplete="name" placeholder="Jordan Doe"></div>' +
      '<div class="field"><label for="coEmailIn">Email</label><input id="coEmailIn" type="email" required autocomplete="email" placeholder="you@example.com"></div>' +
      '<div class="field"><label for="coAddr">Address</label><input id="coAddr" required autocomplete="street-address" placeholder="123 Momentum Ave"></div>' +
      '<div class="field__row"><div class="field"><label for="coCity">City</label><input id="coCity" required autocomplete="address-level2"></div><div class="field"><label for="coZip">ZIP</label><input id="coZip" required inputmode="numeric" autocomplete="postal-code"></div></div>' +
      '<div class="field"><label>Payment</label><div class="co__pay"><span>&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 4242</span><em>Demo card</em></div></div>' +
      '<button type="submit" class="btn btn--solid btn--lg btn--block">Place order <span class="arr">&rarr;</span></button>' +
      '<p class="co__fine">&check; Free shipping over $45 &nbsp;&middot;&nbsp; &check; 60-day guarantee &nbsp;&middot;&nbsp; &check; Cancel anytime</p></form>' +
      '<aside class="co__sum"><h4>Order summary</h4><div class="co__items" id="coItems"></div><div class="co__row"><span>Subtotal</span><b id="coSub"></b></div><div class="co__row"><span>Shipping</span><b id="coShip"></b></div><div class="co__row co__row--total"><span>Total</span><b id="coTotal"></b></div></aside></div>' +
      '<div class="co__done" id="coDone" hidden><div class="co__check">&check;</div><p class="eyebrow">Order placed</p><h3 class="co__title">You&rsquo;re in. Now go do more.</h3><p class="co__done-meta">Order <b id="coNum"></b> &middot; confirmation sent to <b id="coEmail"></b></p><button type="button" class="btn btn--solid" data-modal-close>Back to the site</button></div></div></div>' +
    '<div class="modal modal--quiz" id="quiz-modal" aria-hidden="true" role="dialog" aria-label="Find your formula"><div class="modal__scrim"></div><div class="modal__panel modal__panel--quiz">' +
      '<div class="qm__head"><div class="qm__brand"><img src="assets/mark-orange.png" alt=""><span>Find your formula</span></div><span class="qm__count" id="qCount">1 / 5</span><button type="button" class="modal__close" data-modal-close aria-label="Close">&times;</button></div>' +
      '<div class="qm__bar"><i id="qBar"></i></div><div class="qm__step" id="qStep"></div><div class="qm__foot"><button type="button" class="qm__back" id="qBack" hidden>&larr; Back</button></div></div></div>' +
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>');

  /* ---------- scroll lock · toast · header · drawer ---------- */
  var locks = 0;
  function lock(on) { locks = Math.max(0, locks + (on ? 1 : -1)); document.body.style.overflow = locks ? 'hidden' : ''; }
  var toastEl = $('#toast'), toastT;
  function toast(html) { toastEl.innerHTML = html; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2800); }
  var header = $('#siteHeader');
  if (header) { var onScroll = function () { header.classList.toggle('is-solid', window.scrollY > 40); }; onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); }
  var burger = $('#burger'), drawer = $('#drawer'), scrim = $('#scrim');
  function openDrawer() { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); scrim.hidden = false; requestAnimationFrame(function () { scrim.classList.add('show'); }); burger.setAttribute('aria-expanded', 'true'); lock(true); }
  function closeDrawer() { if (!drawer || !drawer.classList.contains('open')) return; drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); scrim.classList.remove('show'); burger.setAttribute('aria-expanded', 'false'); lock(false); setTimeout(function () { if (!scrim.classList.contains('show')) scrim.hidden = true; }, 400); }
  if (burger) { burger.addEventListener('click', function () { drawer.classList.contains('open') ? closeDrawer() : openDrawer(); }); scrim.addEventListener('click', closeDrawer); $$('a', drawer).forEach(function (a) { a.addEventListener('click', closeDrawer); }); }

  /* ---------- purchase-mode toggles ---------- */
  function initModes(root) {
    var cards = $$('[data-sku]', root); if (root !== document && root.matches && root.matches('[data-sku]')) cards.unshift(root);
    cards.forEach(function (card) {
      if (card.dataset.modeInit) return; card.dataset.modeInit = '1';
      var p = P[card.dataset.sku]; if (!p) return;
      card.dataset.mode = card.dataset.mode || 'once';
      var priceEls = $$('[data-price]', card), btns = $$('.mode__opt', card);
      function paint() {
        var sub = card.dataset.mode === 'sub', q = +(card.dataset.qty || 1);
        priceEls.forEach(function (el) { el.innerHTML = money((sub ? p.sub : p.price) * q) + (sub ? '<small>/mo</small>' : ''); });
        btns.forEach(function (b) { var on = b.dataset.mode === card.dataset.mode; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
      }
      btns.forEach(function (b) { b.addEventListener('click', function () { card.dataset.mode = b.dataset.mode; paint(); }); });
      $$('[data-qty-step]', card).forEach(function (b) { b.addEventListener('click', function () { card.dataset.qty = Math.max(1, Math.min(10, (+(card.dataset.qty || 1)) + Number(b.dataset.qtyStep))); var v = $('[data-qty-val]', card); if (v) v.textContent = card.dataset.qty; paint(); }); });
      paint();
    });
  }
  initModes(document);

  /* ---------- cart ---------- */
  var cart = []; try { cart = JSON.parse(localStorage.getItem('doco_cart') || '[]'); } catch (e) {}
  var bag = $('#bag'), bagScrim = $('#bagScrim'), bagItems = $('#bagItems'), bagSub = $('#bagSub'), bagCount = $('#bagCount'), headCount = $('#cartCount'), shipBar = $('#shipBar'), shipMsg = $('#shipMsg'), checkoutBtn = $('#checkoutBtn');
  function save() { try { localStorage.setItem('doco_cart', JSON.stringify(cart)); } catch (e) {} }
  function linePrice(l) { return l.mode === 'sub' ? P[l.sku].sub : P[l.sku].price; }
  function subtotal() { return cart.reduce(function (s, l) { return s + linePrice(l) * l.qty; }, 0); }
  function count() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function renderCart() {
    var c = count(), sub = subtotal();
    if (headCount) { headCount.textContent = c; headCount.classList.toggle('has', c > 0); }
    bagCount.textContent = c; bagSub.textContent = money(sub);
    shipBar.style.width = Math.min(100, sub / FREE_SHIP * 100) + '%';
    shipMsg.innerHTML = sub >= FREE_SHIP ? '<b>You’ve unlocked free shipping.</b> ✓' : 'Add <b>' + money(FREE_SHIP - sub) + '</b> more for free shipping';
    checkoutBtn.disabled = c === 0;
    if (!cart.length) { bagItems.innerHTML = '<div class="bag__empty"><img src="assets/mark-orange.png" alt=""><h4>Your bag is empty</h4><p>Pick a formula and start doing more.</p><a class="btn btn--solid btn--sm" href="shop.html">Shop the formulas →</a></div>'; return; }
    bagItems.innerHTML = cart.map(function (l, i) { var p = P[l.sku]; return '<div class="line" style="--c:' + p.color + '"><div class="line__img"><img src="' + p.img + '" alt=""></div><div class="line__body"><div class="line__top"><b>' + p.name + '</b><span class="line__price">' + money(linePrice(l) * l.qty) + '</span></div><p class="line__meta">' + (l.mode === 'sub' ? 'Subscribe & save · ' + money(p.sub) + '/mo' : 'One-time · ' + money(p.price)) + '</p><div class="line__ctl"><div class="qty"><button type="button" aria-label="Decrease" data-line-qty="-1" data-i="' + i + '">−</button><span>' + l.qty + '</span><button type="button" aria-label="Increase" data-line-qty="1" data-i="' + i + '">+</button></div><button type="button" class="line__rm" data-rm="' + i + '">Remove</button></div></div></div>'; }).join('');
  }
  function addToCart(sku, mode, qty) {
    if (!P[sku]) return; mode = mode === 'sub' ? 'sub' : 'once'; qty = Math.max(1, qty || 1);
    var i = -1; cart.forEach(function (l, k) { if (l.sku === sku && l.mode === mode) i = k; });
    if (i > -1) cart[i].qty += qty; else cart.push({ sku: sku, mode: mode, qty: qty });
    save(); renderCart();
    toast('<img src="' + P[sku].img + '" alt=""><div><b>Added to your bag</b><span>' + P[sku].name + (qty > 1 ? ' × ' + qty : '') + (mode === 'sub' ? ' · subscription' : '') + '</span></div><button type="button" data-bag-open>View bag</button>');
    if (headCount) { headCount.classList.remove('pop'); void headCount.offsetWidth; headCount.classList.add('pop'); }
  }
  function openBag() { bag.classList.add('open'); bag.setAttribute('aria-hidden', 'false'); bagScrim.hidden = false; requestAnimationFrame(function () { bagScrim.classList.add('show'); }); lock(true); $('.bag__close', bag).focus(); }
  function closeBag() { if (!bag.classList.contains('open')) return; bag.classList.remove('open'); bag.setAttribute('aria-hidden', 'true'); bagScrim.classList.remove('show'); lock(false); setTimeout(function () { bagScrim.hidden = true; }, 400); }
  bagScrim.addEventListener('click', closeBag);
  renderCart();

  /* ---------- checkout (demo) ---------- */
  var co = $('#checkout'), coForm = $('#coForm'), coDone = $('#coDone'), coBody = $('#coBody');
  function openModal(m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); lock(true); var f = $('input, button', m); if (f) setTimeout(function () { f.focus(); }, 50); }
  function closeModal(m) { if (!m.classList.contains('open')) return; m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); lock(false); }
  checkoutBtn.addEventListener('click', function () {
    if (!cart.length) return; closeBag();
    var sub = subtotal(), ship = sub >= FREE_SHIP ? 0 : SHIP_FEE;
    $('#coItems').innerHTML = cart.map(function (l) { var p = P[l.sku]; return '<div class="co__line"><img src="' + p.img + '" alt=""><div><b>' + p.name + '</b><span>' + (l.mode === 'sub' ? 'Subscription' : 'One-time') + ' × ' + l.qty + '</span></div><em>' + money(linePrice(l) * l.qty) + '</em></div>'; }).join('');
    $('#coSub').textContent = money(sub); $('#coShip').textContent = ship ? money(ship) : 'Free'; $('#coTotal').textContent = money(sub + ship);
    coBody.hidden = false; coDone.hidden = true; coForm.classList.remove('was-validated'); openModal(co);
  });
  coForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!coForm.checkValidity()) { coForm.classList.add('was-validated'); coForm.reportValidity(); return; }
    $('#coNum').textContent = 'DOCO-' + Math.random().toString(36).slice(2, 8).toUpperCase(); $('#coEmail').textContent = $('#coEmailIn').value;
    coBody.hidden = true; coDone.hidden = false; cart = []; save(); renderCart();
  });

  /* ---------- product grid + tabs ---------- */
  function cardHTML(sku) {
    var p = P[sku], media = p.pouch ? '<img class="pcard__pouch" src="' + p.pouch + '" alt="' + esc(p.name) + '" loading="lazy">' : '<img src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy">';
    return '<article class="pcard pcard--' + p.kind + '" data-kind="' + p.kind + '" style="--c:' + p.color + '">' +
      '<a class="pcard__media" href="product.html?sku=' + sku + '">' + media + '<span class="pcard__tag">' + esc(p.eyebrow) + '</span></a>' +
      '<div class="pcard__body"><div class="pcard__top"><h3><a href="product.html?sku=' + sku + '">' + esc(p.name) + '</a></h3><span class="pcard__price">' + money(p.price) + '</span></div>' +
      '<p class="pcard__tagline">' + esc(p.tag) + '</p>' +
      '<div class="pcard__foot"><span class="pcard__sub">' + p.strips + ' strips · ' + money(p.sub) + '/mo subscribed</span><a class="pcard__link" href="product.html?sku=' + sku + '">View &rarr;</a></div></div></article>';
  }
  $$('[data-product-grid]').forEach(function (g) {
    var list = ORDER.filter(function (s) { return (!g.dataset.kind || P[s].kind === g.dataset.kind) && s !== g.dataset.exclude; });
    if (g.dataset.limit) list = list.slice(0, +g.dataset.limit);
    g.innerHTML = list.map(cardHTML).join('');
  });
  $$('[data-filter]').forEach(function (t) {
    t.addEventListener('click', function () {
      var wrap = t.closest('.tabs'); $$('[data-filter]', wrap).forEach(function (x) { x.classList.toggle('is-on', x === t); });
      var grid = $(wrap.dataset.target || '[data-product-grid]');
      $$('.pcard', grid).forEach(function (c) { c.classList.toggle('is-hidden', t.dataset.filter !== 'all' && c.dataset.kind !== t.dataset.filter); });
    });
  });

  /* ---------- product detail page ---------- */
  /* ---------- product page v2: ingredient-first ---------- */
  var OTHER = [
    ['pullulan', 'Pullulan', 'A plant-based film made by fermentation — it is what forms the strip itself.'],
    ['cellulose', 'Cellulose', 'Plant fiber that gives the strip its structure.'],
    ['mannitol', 'Mannitol', 'A sugar alcohol for gentle sweetness and a smooth mouthfeel.'],
    ['erythritol', 'Erythritol', 'A low-calorie sugar alcohol used for sweetness.'],
    ['sorbitol', 'Sorbitol syrup', 'A sugar alcohol that keeps the strip flexible.'],
    ['steviol', 'Steviol glycosides', 'Sweetener from the stevia leaf.'],
    ['monk fruit', 'Monk fruit extract', 'Fruit-derived sweetener with no sugar.'],
    ['lecithin', 'Lecithin', 'Helps the ingredients blend evenly through the strip.'],
    ['pectin', 'Pectin', 'Fruit fiber that supports the strip’s texture.'],
    ['medium-chain', 'Medium-chain triglycerides', 'A coconut-derived carrier oil that helps disperse the botanicals.'],
    ['menthol', 'Menthol crystals', 'The cooling note in the mint flavor.'],
    ['spearmint', 'Spearmint flavor', 'Natural mint flavor.'],
    ['peppermint', 'Peppermint flavor', 'Natural mint flavor.'],
    ['cranberry', 'Natural cranberry flavor', 'Natural fruit flavor.'],
    ['strawberry', 'Natural strawberry flavor', 'Natural fruit flavor.'],
    ['lemon', 'Natural lemon flavor', 'Natural citrus flavor.']
  ];
  var TIMING = {
    multi: { when: 'Any time of day', how: 'Make it part of a routine you already keep — with breakfast, at your desk, or on the way out the door. One strip a day.' },
    sport: { when: '15–20 minutes before', how: 'Take one strip before training, a long session or an afternoon that needs a push. It carries a labeled 80 mg of natural caffeine, so count it toward your daily caffeine.' },
    calm: { when: 'When you need a pause', how: 'Before a meeting, after a hard conversation, or whenever the day gets loud. Non-drowsy and built for the middle of a busy day.' },
    sleep: { when: 'About 30 minutes before bed', how: 'Make it the first step of winding down — phone away, lights lower, strip on the tongue. No added melatonin.' }
  };
  var PFAQ = {
    multi: [['Can I take it with food?', 'Yes. Take it whenever it fits your routine; a consistent time each day is what makes the habit stick.'], ['Is it a replacement for a balanced diet?', 'No. It is a convenient daily addition that supports everyday functions alongside the food you eat.']],
    sport: [['How much caffeine is in one strip?', 'A labeled 80 mg of natural caffeine per strip — roughly a small cup of coffee. Count it toward your daily caffeine, and skip it late in the day if you are sensitive.'], ['Why L-theanine?', 'L-theanine is a tea-associated amino acid included alongside caffeine in many focus formulas. It is not a stimulant.']],
    calm: [['Will it make me drowsy?', 'It is designed as a non-drowsy daytime option. Everyone responds differently, so try it first when you have a quiet moment.'], ['What is SunTheanine®?', 'A branded, pure form of L-theanine produced by fermentation and studied for relaxation.']],
    sleep: [['Does it contain melatonin?', 'No. There is no added melatonin in the formula — it relies on tart cherry, saffron and vitamin B6.'], ['Can I take it every night?', 'It is designed for nightly routines. As with any supplement, read the box directions and ask a health professional if you take medication.']]
  };
  function factsHTML(p) {
    return '<div class="facts"><div class="facts__h">Supplement Facts</div><div class="facts__serv"><span>Serving size: 1 strip</span><span>Servings per box: ' + p.strips + '</span></div>' +
      '<table><tr><th>Amount per strip</th><th></th></tr>' + p.ingredients.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
      (p.other ? '<p class="facts__other"><b>Other ingredients:</b> ' + p.other + '</p>' : '') +
      '<p class="facts__legal">These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.</p></div>';
  }
  function otherHTML(p) {
    var parts = (p.other || '').toLowerCase(), seen = {}, items = [];
    OTHER.forEach(function (o) { if (parts.indexOf(o[0]) > -1 && !seen[o[1]]) { seen[o[1]] = 1; items.push('<li><b>' + o[1] + '</b><span>' + o[2] + '</span></li>'); } });
    return items.join('');
  }
  function howHTML() {
    return '<ol class="hsteps"><li class="hstep"><img src="assets/step-peel.webp" alt="" loading="lazy"><b>Peel</b><span>Open one strip when you’re ready.</span></li><li class="hstep"><img src="assets/step-place.webp" alt="" loading="lazy"><b>Place</b><span>Rest it on your tongue. No water.</span></li><li class="hstep"><img src="assets/step-go.webp" alt="" loading="lazy"><b>Go</b><span>It dissolves in about 15 seconds.</span></li></ol>';
  }
  var pdp = $('#pdp');
  if (pdp) {
    var sku = (new URLSearchParams(location.search).get('sku') || 'multi'); if (!P[sku]) sku = 'multi';
    var p = P[sku], isB = p.kind === 'bundle'; document.title = p.name + ' — DOCO';
    pdp.style.setProperty('--c', p.color); pdp.dataset.sku = sku;
    var keys = isB ? p.includes.map(function (s) { return { a: P[s].ingredients[0][1], n: P[s].name }; }) : p.ingredients.slice(0, 3).map(function (r) { return { a: r[1], n: r[0] }; });
    var first = isB ? P[p.includes[0]] : p, timing = TIMING[isB ? p.includes[0] : sku];
    var html =
      '<div class="pdp__hero"><div class="container pdp__crumbs"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / <span>' + esc(p.name) + '</span></div>' +
      '<div class="container pdp__grid"><div class="pdp__gallery"><div class="pdp__main"><img id="pdpMain" src="' + p.gallery[0] + '" alt="' + esc(p.name) + '"></div>' +
      '<div class="pdp__thumbs">' + p.gallery.map(function (g, i) { return '<button type="button" class="' + (i ? '' : 'is-on') + '" data-thumb="' + g + '" aria-label="Image ' + (i + 1) + '"><img src="' + g + '" alt=""></button>'; }).join('') + '</div></div>' +
      '<div class="pdp__info"><p class="eyebrow">' + esc(p.eyebrow) + '</p><h1 class="display">' + esc(p.name) + '</h1><p class="serif-accent">' + esc(p.tag) + '</p>' +
      '<ul class="pdp__chips">' + (p.flavor ? '<li>' + esc(p.flavor) + ' flavor</li>' : '') + '<li>' + p.strips + ' strips</li>' + p.pills.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<p class="pdp__desc">' + p.desc + '</p>' +
      '<div class="pdp__keys">' + keys.map(function (k) { return '<div class="pdp__key"><b>' + esc(k.a) + '</b><span>' + esc(k.n) + '</span></div>'; }).join('') + '</div>' +
      '<a class="pdp__more" href="#inside">See the full panel ↓</a>' +
      '<div class="mode mode--light" role="radiogroup" aria-label="Purchase option" style="margin-top:18px"><button type="button" class="mode__opt is-on" data-mode="once" role="radio">One-time <b>' + money(p.price) + '</b></button><button type="button" class="mode__opt" data-mode="sub" role="radio">Subscribe &amp; save <b>' + money(p.sub) + '/mo</b></button></div>' +
      '<div class="pdp__buy"><div class="qty qty--lg"><button type="button" data-qty-step="-1" aria-label="Decrease">−</button><span data-qty-val>1</span><button type="button" data-qty-step="1" aria-label="Increase">+</button></div>' +
      '<button type="button" class="btn btn--solid btn--lg" data-add="' + sku + '">Add to bag — <span data-price></span></button></div>' +
      '<ul class="pdp__perks"><li>Dissolves in ~15 seconds</li><li>No water needed</li><li>' + p.strips + ' strips per box</li></ul></div></div></div>';
    /* inside your strip */
    if (!isB) {
      html += '<section class="psec psec--tint" id="inside"><div class="container"><div class="psec__head"><div><p class="eyebrow">Inside your strip</p><h2 class="display">What’s in ' + esc(p.name) + '</h2></div><p>' + esc(p.inside) + '</p></div>' +
        '<div class="spots' + (p.ingredients.length > 6 ? ' spots--many' : '') + '">' + p.ingredients.map(function (r, i) { return '<div class="spot"><span class="spot__idx">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span><span class="spot__amt">' + r[1] + '</span><span class="spot__name">' + r[0] + '</span><span class="spot__note">' + r[2] + '</span></div>'; }).join('') + '</div>' +
        (p.note ? '<p class="ingr__note" style="margin-top:18px">✓ ' + p.note + '</p>' : '') + '</div></section>';
      html += '<section class="psec"><div class="container facts-wrap">' + factsHTML(p) +
        '<div class="facts-note"><h3>Read the label with us</h3><p>Every amount above is printed on the box. We list actives in plain numbers so you know exactly what you are choosing — nothing hidden in a blend.</p><ul>' + p.benefits.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul></div></div></section>';
      html += '<section class="psec psec--tint"><div class="container"><div class="psec__head"><div><p class="eyebrow">The rest of the strip</p><h2 class="display">Other ingredients, explained</h2></div><p>The supporting ingredients that form, sweeten, flavor and stabilize a strip — and why each one is there.</p></div><ul class="oth">' + otherHTML(p) + '</ul></div></section>';
    } else {
      html += '<section class="psec psec--tint" id="inside"><div class="container"><div class="psec__head"><div><p class="eyebrow">What’s in the box</p><h2 class="display">' + p.includes.length + ' formulas, one box</h2></div><p>' + esc(p.inside) + ' Bundles are shopping options, not directions to use products together.</p></div>' +
        '<div class="bundle-inc">' + p.includes.map(function (s) { var q = P[s]; return '<div class="inc" style="--c:' + q.color + '"><img src="' + q.pouch + '" alt="" loading="lazy"><div><b>' + esc(q.name) + '</b><span>' + q.ingredients.slice(0, 3).map(function (r) { return r[0] + ' ' + r[1]; }).join(' · ') + '</span><a href="product.html?sku=' + s + '">Full panel →</a></div></div>'; }).join('') + '</div></div></section>';
      html += '<section class="psec"><div class="container"><div class="psec__head"><div><p class="eyebrow">Supplement facts</p><h2 class="display">Every panel, side by side</h2></div><p>Each formula’s full label, exactly as printed on its box.</p></div><div class="facts-grid">' + p.includes.map(function (s) { return '<div style="--c:' + P[s].color + '"><p class="eyebrow" style="margin-bottom:8px">' + esc(P[s].name) + '</p>' + factsHTML(P[s]) + '</div>'; }).join('') + '</div></div></section>';
    }
    /* when & how */
    html += '<section class="psec"><div class="container when"><div class="when__tile"><p class="eyebrow">When to take it</p><h3>' + esc(timing.when) + '</h3><p>' + timing.how + '</p><p class="ingr__meta">Ask a health professional before starting a supplement if pregnant, nursing, taking medication, or managing a health condition. Use only as directed on the box.</p></div><div><div class="psec__head" style="margin-bottom:18px"><div><p class="eyebrow">How to take it</p><h2 class="display">Peel. Place. Go.</h2></div></div>' + howHTML() + '</div></div></section>';
    /* why a strip */
    html += '<section class="psec psec--dark"><div class="container"><div class="psec__head"><div><p class="eyebrow eyebrow--light">Why a strip</p><h2 class="display display--light">Built to actually get taken</h2></div><p>The best formula is the one you keep using. A strip removes every excuse.</p></div><ul class="whystrip"><li><b>~15s</b><span>Dissolves on the tongue in seconds — no glass of water, nothing to swallow.</span></li><li><b>30 strips</b><span>A whole box fits a pocket, a gym bag, a carry-on. No bottles rattling around.</span></li><li><b>1 strip</b><span>One labeled dose per strip. No scoops, no guessing.</span></li></ul></div></section>';
    /* good to know */
    var faqs = isB ? [].concat.apply([], p.includes.map(function (s) { return PFAQ[s].slice(0, 1); })) : PFAQ[sku];
    html += '<section class="psec psec--tint"><div class="container pfaq"><div><p class="eyebrow">Good to know</p><h2 class="display" style="font-size:clamp(1.9rem,3.6vw,3rem)">Questions about ' + esc(p.name) + '</h2></div><div class="faq__list">' + faqs.map(function (f) { return '<details class="qa"><summary>' + f[0] + '<span class="qa__ic"></span></summary><p>' + f[1] + '</p></details>'; }).join('') + '<details class="qa"><summary>Can I combine it with other DOCO formulas?<span class="qa__ic"></span></summary><p>Check each label and ask a health professional before combining supplements or medications. Our bundles are shopping options, not directions to use products together.</p></details></div></div></section>';
    pdp.innerHTML = html;
    initModes(pdp);
    pdp.addEventListener('click', function (e) { var t = e.target.closest('[data-thumb]'); if (!t) return; $('#pdpMain').src = t.dataset.thumb; $$('[data-thumb]', pdp).forEach(function (x) { x.classList.toggle('is-on', x === t); }); });
    var rel = $('[data-related]'); if (rel) { var list = ORDER.filter(function (s) { return s !== sku; }); if (p.kind === 'bundle') list = p.includes.concat(list.filter(function (s) { return p.includes.indexOf(s) < 0; })); rel.innerHTML = list.slice(0, 3).map(cardHTML).join(''); }
  }

  /* ---------- global clicks ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-add]');
    if (t) { e.preventDefault(); var card = t.closest('[data-sku]'); addToCart(t.dataset.add, t.dataset.mode || (card && card.dataset.mode) || 'once', +((card && card.dataset.qty) || 1));
      t.classList.add('is-added'); var orig = t.innerHTML; t.innerHTML = 'Added ✓'; setTimeout(function () { t.innerHTML = orig; t.classList.remove('is-added'); }, 1400); return; }
    if (e.target.closest('[data-bag-open]')) { e.preventDefault(); closeDrawer(); openBag(); return; }
    if (e.target.closest('[data-bag-close]')) { e.preventDefault(); closeBag(); return; }
    var q = e.target.closest('[data-line-qty]'); if (q) { var i = +q.dataset.i; if (!cart[i]) return; cart[i].qty = Math.max(0, cart[i].qty + Number(q.dataset.lineQty)); if (!cart[i].qty) cart.splice(i, 1); save(); renderCart(); return; }
    var r = e.target.closest('[data-rm]'); if (r) { cart.splice(+r.dataset.rm, 1); save(); renderCart(); return; }
    var mc = e.target.closest('[data-modal-close]'); if (mc) { closeModal(mc.closest('.modal')); var sc = mc.dataset.scroll; if (sc) setTimeout(function () { var el = $(sc); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 300); return; }
  });
  $$('.modal__scrim').forEach(function (s) { s.addEventListener('click', function () { closeModal(s.closest('.modal')); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrawer(); closeBag(); $$('.modal.open').forEach(closeModal); } });

  /* ---------- quiz ---------- */
  var QUESTIONS = [
    { q: 'What’s your #1 goal right now?', sub: 'Pick the one that matters most this month.', opts: [
      { t: 'Energy for training', d: 'Gym, runs, game day', s: { sport: 3, multi: 1 } }, { t: 'Focus for work', d: 'Deep work, long days', s: { sport: 2, calm: 1 } },
      { t: 'Less stress', d: 'Stay cool under pressure', s: { calm: 3 } }, { t: 'Better sleep', d: 'Fall asleep faster, wake up ready', s: { sleep: 3 } }, { t: 'A daily health baseline', d: 'Cover the basics, every day', s: { multi: 3 } } ] },
    { q: 'When does your day hit a wall?', opts: [ { t: 'First thing in the morning', s: { sport: 2, multi: 1 } }, { t: 'The mid-afternoon slump', s: { sport: 2 } }, { t: 'Evening — I can’t switch off', s: { calm: 2, sleep: 1 } }, { t: 'At night — I can’t fall asleep', s: { sleep: 2 } }, { t: 'I don’t crash — I want consistency', s: { multi: 2 } } ] },
    { q: 'How’s your sleep lately?', opts: [ { t: 'Great, honestly', s: { multi: 1 } }, { t: 'Fine, but it could be deeper', s: { sleep: 1, calm: 1 } }, { t: 'Rough — I lie awake', s: { sleep: 3 } }, { t: 'Short — I’m up early by choice', s: { sport: 1, multi: 1 } } ] },
    { q: 'Describe your typical day.', opts: [ { t: 'Nonstop & physical', s: { sport: 2, multi: 1 } }, { t: 'Nonstop & mental', s: { calm: 2, sport: 1 } }, { t: 'Steady — I want to do more', s: { multi: 2, sport: 1 } }, { t: 'Honestly, overwhelming', s: { calm: 3 } } ] },
    { q: 'How do you feel about caffeine?', opts: [ { t: 'Love it', s: { sport: 2 } }, { t: 'A little is fine', s: { sport: 1, multi: 1 } }, { t: 'No thanks — jitters', s: { calm: 2, sleep: 1, sport: -3 } } ] }
  ];
  var quiz = $('#quiz-modal'), qStep = $('#qStep'), qBar = $('#qBar'), qCount = $('#qCount'), qBack = $('#qBack'), qi = 0, answers = [];
  function renderQ(dir) {
    var q = QUESTIONS[qi]; qBar.style.width = (qi / QUESTIONS.length * 100) + '%'; qCount.textContent = (qi + 1) + ' / ' + QUESTIONS.length; qBack.hidden = qi === 0;
    qStep.innerHTML = '<div class="q' + (dir ? ' q--' + dir : '') + '"><p class="q__kicker">Question ' + (qi + 1) + '</p><h3 class="q__title">' + q.q + '</h3>' + (q.sub ? '<p class="q__sub">' + q.sub + '</p>' : '') + '<div class="q__opts">' + q.opts.map(function (o, k) { return '<button type="button" class="q__opt' + (answers[qi] === k ? ' is-on' : '') + '" data-opt="' + k + '"><span class="q__n">' + String.fromCharCode(65 + k) + '</span><span><b>' + o.t + '</b>' + (o.d ? '<small>' + o.d + '</small>' : '') + '</span></button>'; }).join('') + '</div></div>';
  }
  function renderResult() {
    var s = { multi: 0, sport: 0, calm: 0, sleep: 0 };
    answers.forEach(function (a, k) { var o = QUESTIONS[k].opts[a]; for (var key in o.s) s[key] += o.s[key]; });
    var order = Object.keys(s).sort(function (a, b) { return s[b] - s[a]; }), top = order[0], second = order[1], p = P[top];
    qBar.style.width = '100%'; qCount.textContent = 'Your match'; qBack.hidden = false;
    var pair = null;
    if (s[second] >= s[top] - 1 && s[second] > 0) { if ([top, second].sort().join() === 'multi,sport') pair = 'duo-domore'; if ([top, second].sort().join() === 'calm,sleep') pair = 'duo-relax'; }
    var up = pair || (s[order[0]] - s[order[3]] <= 3 ? 'stack' : null);
    qStep.innerHTML = '<div class="q q--in result" style="--c:' + p.color + '" data-sku="' + top + '" data-mode="once">' +
      '<div class="result__media"><img src="' + p.img + '" alt="' + p.name + '"><span class="result__stamp">Your match</span></div>' +
      '<div class="result__body"><p class="q__kicker">Built for your day</p><h3 class="result__name">' + p.name + '</h3><p class="serif-accent result__tag">' + p.tag + '</p>' +
      '<ul class="result__why">' + p.benefits.map(function (w) { return '<li>' + w + '</li>'; }).join('') + '</ul>' +
      '<div class="mode mode--light" role="radiogroup" aria-label="Purchase option"><button type="button" class="mode__opt is-on" data-mode="once" role="radio">One-time <b>' + money(p.price) + '</b></button><button type="button" class="mode__opt" data-mode="sub" role="radio">Subscribe &amp; save <b>' + money(p.sub) + '/mo</b></button></div>' +
      '<div class="result__cta"><button type="button" class="btn btn--solid btn--lg" data-add="' + top + '">Add to bag →</button><a class="btn btn--text" href="product.html?sku=' + top + '">See details</a></div>' +
      (up ? '<div class="result__up"><img src="' + P[up].img + '" alt=""><div><span>Also a strong fit</span><b>' + P[up].name + '</b><small>' + P[up].tag + ' · ' + money(P[up].price) + '</small></div><button type="button" class="btn btn--chip" data-add="' + up + '" data-mode="once">Add</button></div>' : '') +
      '<button type="button" class="result__retake" data-retake>Retake the quiz</button></div></div>';
    initModes(qStep);
  }
  $$('[data-quiz-open]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); closeDrawer(); qi = 0; answers = []; renderQ(); openModal(quiz); }); });
  qStep.addEventListener('click', function (e) {
    var o = e.target.closest('[data-opt]');
    if (o) { answers[qi] = +o.dataset.opt; o.classList.add('is-on'); setTimeout(function () { if (qi < QUESTIONS.length - 1) { qi++; renderQ('in'); } else renderResult(); }, 260); return; }
    if (e.target.closest('[data-retake]')) { qi = 0; answers = []; renderQ('in'); }
  });
  qBack.addEventListener('click', function () { if (qCount.textContent === 'Your match') qi = QUESTIONS.length - 1; else if (qi > 0) qi--; renderQ('back'); });

  /* ---------- showcase v3: scroll-pinned stage · scroll-scrubbed spin · drag-to-spin spring · pointer tilt · ingredient reveals ---------- */
  (function () {
    var sc = $('#showcase'); if (!sc) return;
    var stage = $('.showcase__stage', sc), slides = $$('.slide', sc), dots = $$('.showcase__dots button, .showcase__tabs button', sc), cur = $('.showcase__cur', sc), wipe = $('.showcase__wipe', sc), n = slides.length, active = -1, ticking = false;
    var KEYS = [0.08, 0.26, 0.44];            /* sub-progress at which ingredient 1 / 2 / 3 pop in */
    var scrollSpin = 0, lift = 0;
    var drag = { on: false, x0: 0, last: 0, start: 0, rot: 0, vel: 0, raf: null, el: null };
    if (reduced) { slides.forEach(function (s) { s.classList.add('is-active', 'is-k1', 'is-k2', 'is-k3'); }); return; }
    function metrics() { return { top: sc.getBoundingClientRect().top + window.scrollY, scrub: sc.offsetHeight - window.innerHeight }; }
    function paint() { var s = slides[active]; if (!s) return; var a = Math.max(-84, Math.min(84, scrollSpin + drag.rot)); s.style.setProperty('--spin', a.toFixed(2) + 'deg'); s.style.setProperty('--lift', lift.toFixed(1) + 'px'); }
    function set(i) {
      if (i === active) return;
      var prev = active;
      if (active > -1) { slides[active].style.removeProperty('--spin'); slides[active].style.removeProperty('--lift'); }
      active = i;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); s.classList.toggle('is-before', k < i); s.classList.toggle('is-after', k > i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
      if (wipe && prev > -1) { wipe.style.background = slides[i].dataset.color; wipe.classList.remove('is-run'); void wipe.offsetWidth; wipe.classList.add('is-run'); }
      stage.style.setProperty('--stage', slides[i].dataset.color); if (cur) cur.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
    }
    function update() {
      ticking = false;
      var m = metrics(), p = Math.max(0, Math.min(0.9999, (window.scrollY - m.top) / Math.max(1, m.scrub))), i = Math.floor(p * n), q = p * n - i;
      set(i);
      var s = slides[i];
      scrollSpin = (q - 0.5) * -58;            /* the pouch turns ~58° across its own scroll span */
      lift = (0.5 - q) * 34;                   /* …and drifts upward as it goes */
      s.classList.toggle('is-k1', q > KEYS[0]); s.classList.toggle('is-k2', q > KEYS[1]); s.classList.toggle('is-k3', q > KEYS[2]);
      paint();
    }
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    function goTo(i) { i = Math.max(0, Math.min(n - 1, i)); var m = metrics(); window.scrollTo({ top: m.top + (i + 0.62) * (m.scrub / n), behavior: 'smooth' }); }
    $$('.showcase__arrow', sc).forEach(function (b) { b.addEventListener('click', function () { goTo(active + Number(b.dataset.dir)); }); });
    dots.forEach(function (d) { d.addEventListener('click', function () { goTo(Number(d.dataset.go)); }); });
    window.addEventListener('scroll', req, { passive: true }); window.addEventListener('resize', req); update();

    /* pointer tilt: the pouch leans toward the cursor, the glare tracks it, the ingredient keys drift in parallax */
    function applyTilt(px, py) { var s = slides[active]; if (!s) return; var st = $('.slide__stage', s), r = st.getBoundingClientRect(); var x = (px - r.left) / r.width - .5, y = (py - r.top) / r.height - .5; x = Math.max(-.6, Math.min(.6, x)); y = Math.max(-.6, Math.min(.6, y));
      s.style.setProperty('--ry', (x * 22).toFixed(2) + 'deg'); s.style.setProperty('--rx', (-y * 16).toFixed(2) + 'deg'); s.style.setProperty('--px', (x * 26).toFixed(1) + 'px'); s.style.setProperty('--py', (y * 26).toFixed(1) + 'px'); s.style.setProperty('--gx', (42 + x * 80).toFixed(1) + '%'); s.style.setProperty('--gy', (30 + y * 80).toFixed(1) + '%'); s.classList.add('is-tilting'); }
    function clearTilt() { slides.forEach(function (s) { ['--ry', '--rx', '--px', '--py', '--gx', '--gy'].forEach(function (v) { s.style.removeProperty(v); }); s.classList.remove('is-tilting'); }); }

    /* drag-to-spin with a spring: grab the pouch, throw it, and it swings back to its scroll position */
    function spring() {
      drag.raf = null; if (drag.on) return;
      drag.vel += -drag.rot * 0.07; drag.vel *= 0.84; drag.rot += drag.vel;
      if (Math.abs(drag.rot) < 0.08 && Math.abs(drag.vel) < 0.08) { drag.rot = 0; drag.vel = 0; paint(); return; }
      paint(); drag.raf = requestAnimationFrame(spring);
    }
    stage.addEventListener('pointerdown', function (e) {
      var pouch = e.target.closest('.pouch'); if (!pouch || e.button > 0) return;
      if (drag.raf) { cancelAnimationFrame(drag.raf); drag.raf = null; }
      drag.on = true; drag.el = pouch; drag.x0 = e.clientX; drag.last = e.clientX; drag.start = drag.rot; drag.vel = 0;
      pouch.classList.add('is-drag'); clearTilt(); try { pouch.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) {
      if (drag.on) { var r = drag.start + (e.clientX - drag.x0) * 0.55, lim = 75; if (Math.abs(r) > lim) r = Math.sign(r) * (lim + (Math.abs(r) - lim) * 0.22); drag.vel = Math.max(-14, Math.min(14, (e.clientX - drag.last) * 0.55)); drag.last = e.clientX; drag.rot = r; paint(); return; }
      if (e.pointerType === 'touch') return; applyTilt(e.clientX, e.clientY);
    });
    function endDrag(e) { if (!drag.on) return; drag.on = false; if (drag.el) { drag.el.classList.remove('is-drag'); try { drag.el.releasePointerCapture(e.pointerId); } catch (_) {} } if (!drag.raf) drag.raf = requestAnimationFrame(spring); }
    stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', function () { if (!drag.on) clearTilt(); });
  })();

  /* ---------- build your stack: pick formulas → duo / variety pricing ---------- */
  (function () {
    var b = $('[data-builder]'); if (!b) return;
    var picks = $$('.pick', b), UNIT = P.multi.price;
    var el = { name: $('[data-b-name]', b), count: $('[data-b-count]', b), strips: $('[data-b-strips]', b), price: $('[data-b-price]', b), was: $('[data-b-was]', b), save: $('[data-b-save]', b), note: $('[data-b-note]', b), cta: $('[data-b-cta]', b) };
    function calc() {
      var on = picks.filter(function (p) { return p.classList.contains('is-on'); }).map(function (p) { return p.dataset.pick; }), n = on.length, sku = null;
      if (n === 4) sku = 'stack';
      else if (n === 2) { if (on.indexOf('multi') > -1 && on.indexOf('sport') > -1) sku = 'duo-domore'; else if (on.indexOf('calm') > -1 && on.indexOf('sleep') > -1) sku = 'duo-relax'; }
      else if (n === 1) sku = on[0];
      var full = n * UNIT, price = sku ? P[sku].price : full, bundle = sku && P[sku].kind === 'bundle';
      el.name.textContent = n === 0 ? 'Nothing picked yet' : sku ? P[sku].name : n + ' formulas, your way';
      el.count.textContent = n; el.strips.textContent = n * 30;
      el.price.textContent = n ? money(price) : '$0';
      el.was.hidden = !(price < full); el.was.textContent = money(full);
      el.save.hidden = !(price < full); el.save.textContent = 'Save ' + money(full - price);
      el.note.textContent = n === 0 ? 'tap a formula above' : sku === 'stack' ? 'the best value in the lineup' : bundle ? 'duo price unlocked' : n === 1 ? 'pair it to unlock a duo price' : n === 3 ? 'add the fourth for the Variety Pack price' : 'pair Multivitamin + Sports Energy or Calm + Sleep for a duo price';
      el.cta.href = sku ? 'product.html?sku=' + sku : 'shop.html';
      el.cta.innerHTML = (sku ? 'View ' + esc(P[sku].name) : n ? 'Shop these formulas' : 'Browse all formulas') + ' <span class="arr">&rarr;</span>';
    }
    picks.forEach(function (p) { p.addEventListener('click', function () { p.classList.toggle('is-on'); p.setAttribute('aria-pressed', p.classList.contains('is-on')); calc(); }); });
    calc();
  })();

  /* ---------- scroll reveal ---------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length && !reduced) { var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }); reveals.forEach(function (el) { io.observe(el); }); }
  else reveals.forEach(function (el) { el.classList.add('in'); });

  /* This launch is a product catalog, not a working store. Keep purchase
     controls inaccessible until a real checkout and fulfillment flow exists. */
  if (!COMMERCE_ENABLED) {
    $$('[data-add]').forEach(function (el) {
      el.removeAttribute('data-add');
      el.disabled = true;
      el.textContent = 'Orders opening at launch';
      el.setAttribute('aria-label', 'Orders are not open yet');
    });
    $$('.mode, [data-bag-open], #bag, #bagScrim, #checkout').forEach(function (el) { el.hidden = true; });
  }
})();
