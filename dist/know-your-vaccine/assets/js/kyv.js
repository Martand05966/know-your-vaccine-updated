/* Know Your Vaccine - shared flow for mobile and desktop.
   Layout differences live in mobile.css / desktop.css; this file owns behaviour only.
   Data: window.KYV = { site: {...}, content: {...} } baked by src/build_site.py from config/.

   Screens (one at a time, inside #kyv-app):
     intro -> about (age + gender) -> health -> contact -> thinking (AI build) -> results
     about with an under-18 age -> noteligible (PharmEasy vaccinates adults only)

   Every answer and click is saved to Google Sheets through apps_script/Code.gs: one row per
   session in "responses" (upserted) and one row per action in "events". Health answers go ONLY
   to the sheet, never to dataLayer/pixels. */
(function () {
  'use strict';
  var K = window.KYV || {}, S = K.site || {}, C = K.content || {};
  var VACCINES = C.vaccines || [], BY_ID = {};
  VACCINES.forEach(function (v) { BY_ID[v.id] = v; });
  var R = C.results || {};

  /* ---------------- helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function rupees(n) {
    n = Number(n);
    return '₹' + n.toLocaleString('en-IN', n % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {});
  }
  function labelOf(list, id) { for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i].label; return ''; }
  function withSrc(url) { return url + (url.indexOf('?') > -1 ? '&' : '?') + 'src=' + encodeURIComponent(S.src || 'knowyourvaccine'); }
  function optionUrl(o) { return withSrc(o.url || ('https://pharmeasy.in/search/all?name=' + encodeURIComponent(o.name))); }
  function store(kind, key, val) {
    try {
      var st = kind === 'local' ? window.localStorage : window.sessionStorage;
      if (val !== undefined) { st.setItem(key, val); return val; }
      return st.getItem(key) || '';
    } catch (e) { return val || ''; }
  }
  function uid(prefix) {
    return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  var isDesktop = window.matchMedia && window.matchMedia('(min-width: 820px) and (pointer: fine)').matches;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ICONS = {
    lungs: '<path d="M12 4v8"/><path d="M12 12c-1.5 0-3-1-3-3V7"/><path d="M12 12c1.5 0 3-1 3-3V7"/><path d="M9 7C6 7 4 11 4 15c0 2 1 4 3 4s3-1 3-3v-4"/><path d="M15 7c3 0 5 4 5 8 0 2-1 4-3 4s-3-1-3-3v-4"/>',
    ribbon: '<path d="M12 3a4 4 0 0 0-4 4c0 3 4 7 4 7s4-4 4-7a4 4 0 0 0-4-4z"/><path d="M9.5 12 6 21l3-1.5L11 21l1-4"/><path d="M14.5 12 18 21l-3-1.5L13 21l-1-4"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    drop: '<path d="M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
    liver: '<path d="M4 9c0-3 3-5 7-5 5 0 9 2 9 6 0 5-5 9-9 10-2 0-3-2-3-4s-4-2-4-7z"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    brain: '<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 2V5a2 2 0 0 0-3-2z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 2"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    up: '<path d="M7 10v12"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>',
    down: '<path d="M17 14V2"/><path d="M9 18.1 10 14H4.2a2 2 0 0 1-1.9-2.6l2.3-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.8a2 2 0 0 0-1.8 1.1L12 22a3.1 3.1 0 0 1-3-3.9z"/>',
    arrow: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>'
  };
  function icon(name, size) {
    var s = size || 22;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.shield) + '</svg>';
  }
  var SPARK = '<svg class="kyv-spark" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/><path fill="currentColor" d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';

  /* ---------------- attribution ---------------- */
  function param(n) {
    var m = location.search.match(new RegExp('[?&]' + n + '=([^&]*)'));
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }
  function cookie(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function keep(key, v) { return v ? store('local', key, v) : store('local', key); }
  var ATTR = {
    utm_source: param('utm_source'), utm_medium: param('utm_medium'), utm_campaign: param('utm_campaign'),
    utm_term: param('utm_term'), utm_content: param('utm_content'),
    gclid: keep('kyv_gclid', param('gclid')), wbraid: keep('kyv_wbraid', param('wbraid')), gbraid: keep('kyv_gbraid', param('gbraid'))
  };
  (function () {
    var fbclid = param('fbclid'), fbc = cookie('_fbc');
    if (!fbc && fbclid) fbc = 'fb.1.' + Date.now() + '.' + fbclid;
    ATTR.fbc = keep('kyv_fbc', fbc);
  })();

  /* ---------------- tracking ---------------- */
  window.dataLayer = window.dataLayer || [];
  function dl(event, p) {
    var o = { event: event, page_type: 'know_your_vaccine' };
    if (p) for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) o[k] = p[k];
    window.dataLayer.push(o);
  }

  /* ---------------- state ---------------- */
  function freshState() {
    return {
      session_id: store('session', 'kyv_sid', uid('S-')), lead_id: '', step: 'intro', age: '', gender: '', flags: [],
      name: '', phone: '', consent: true, plan: [], options: [], notify: [], booked: [], callback: false, feedback: '',
      doctor_click: false, family_of: '', started_at: 0, status: 'started'
    };
  }
  var prevSid = store('session', 'kyv_sid');
  var state = freshState();
  if (prevSid) state.session_id = store('session', 'kyv_sid', prevSid);
  var started = false;
  function markStart() {
    if (started) return; started = true; state.started_at = Date.now();
    dl('kyv_start');
  }

  /* ---------------- Google Sheets sync ---------------- */
  function names(ids) { return ids.map(function (id) { return BY_ID[id] ? BY_ID[id].name : id; }).join(', '); }
  function snapshot(event, detail) {
    var must = state.plan.filter(function (r) { return r.tier === 'must'; }).map(function (r) { return r.id; });
    var maybe = state.plan.filter(function (r) { return r.tier === 'maybe'; }).map(function (r) { return r.id; });
    var p = {
      key: S.sheets_key || '', event: event, event_detail: detail || '',
      session_id: state.session_id, lead_id: state.lead_id, family_of: state.family_of, status: state.status,
      for_whom: state.family_of ? 'Family member' : 'Myself',
      age_group: labelOf(C.ages, state.age), gender: labelOf(C.genders, state.gender),
      conditions: state.flags.map(function (f) { return labelOf(C.flags, f); }).join(', '),
      name: state.name, phone: state.phone, consent: state.consent ? 'yes' : 'no',
      recommended_must: names(must), recommended_maybe: names(maybe),
      plan_value: must.reduce(function (s, id) { return s + BY_ID[id].price; }, 0),
      option_clicks: state.options.join(', '), notify_requests: state.notify.join(', '), book_clicks: names(state.booked),
      callback_requested: state.callback ? 'yes' : '', feedback: state.feedback,
      doctor_click: state.doctor_click ? 'yes' : 'no',
      device: isDesktop ? 'desktop' : 'mweb', page_url: location.href, referrer: document.referrer,
      user_agent: navigator.userAgent, elapsed_ms: state.started_at ? Date.now() - state.started_at : 0,
      honeypot: ($('#kyv-hp') || {}).value || ''
    };
    for (var k in ATTR) if (Object.prototype.hasOwnProperty.call(ATTR, k)) p[k] = ATTR[k] || '';
    p.fbp = cookie('_fbp') || '';
    return p;
  }
  // text/plain keeps the request CORS-simple (no preflight), which Apps Script web apps need.
  function sync(event, detail, opts) {
    if (!S.sheets_webhook_url) { if (window.console) console.info('[kyv] sheet sync skipped (no webhook):', event); return Promise.resolve(null); }
    var body = JSON.stringify(snapshot(event, detail));
    if (opts && opts.beacon && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(S.sheets_webhook_url, new Blob([body], { type: 'text/plain;charset=utf-8' }))) return Promise.resolve(null); } catch (e) {}
    }
    var tries = (opts && opts.retries) || 1;
    function attempt(n) {
      return fetch(S.sheets_webhook_url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: true })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (!d || d.ok !== true) throw new Error('not ok'); return d; })
        .catch(function (e) {
          if (n > 1) return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return attempt(n - 1); });
          throw e;
        });
    }
    return attempt(tries).catch(function () { return null; });
  }

  /* ---------------- rules engine (adults only, indicative) ---------------- */
  function flagVisible(f) {
    if (f.show === 'female_18_49') return state.gender === 'female' && (state.age === 'young' || state.age === 'adult');
    return true;
  }
  function isMinor() {
    var m = (C.adult_only && C.adult_only.minor_ages) || [];
    return m.indexOf(state.age) > -1;
  }
  function recommend() {
    var a = state.age, out = [];
    function has(x) { return state.flags.indexOf(x) > -1; }
    function add(id, tier, reason) { if (BY_ID[id]) out.push({ id: id, tier: tier, reason: reason }); }
    var older = a === 'mid' || a === 'senior';
    var chronic = has('diabetes') || has('heartlung') || has('immuno');
    var preg = has('pregnant');
    var foodRisk = has('travel') || has('outside_food');

    if (preg) add('flu', 'must', 'Recommended in pregnancy. It protects you and passes protection to your newborn.');
    else if (chronic) add('flu', 'must', 'Flu can worsen diabetes, heart and lung conditions. A yearly dose lowers that risk.');
    else if (older) add('flu', 'must', 'After 50, flu more often leads to pneumonia. Take one dose every year.');
    else add('flu', 'must', 'Flu strains change every season, so a yearly dose keeps you protected.');

    if (!preg) {
      if (a === 'young') add('hpv', 'must', 'HPV can lead to cervical and other cancers. Catch-up is advised up to 26.');
      else if (a === 'adult') add('hpv', 'maybe', 'Adults up to 45 may still benefit. Worth asking a doctor.');
    }

    if (older) add('pneumo', 'must', 'Pneumonia risk rises after 50. This guards against its most common cause.');
    else if (chronic) add('pneumo', 'must', 'Diabetes, heart or lung disease and weak immunity raise the risk of serious pneumonia.');

    if (foodRisk) {
      add('typhoid', 'maybe', 'Typhoid spreads through contaminated food and water. Useful if you eat out or travel.');
      add('hepa', 'maybe', 'Hepatitis A is a liver infection spread through food and water.');
    }

    if (!preg) {
      if (older) add('shingles', 'must', 'Shingles risk rises sharply after 50 and can leave lasting nerve pain.');
      else if (has('immuno')) add('shingles', 'maybe', 'Adults with weak immunity are at higher risk of shingles.');
    }

    if (has('travel')) add('mening', 'maybe', 'Required for Hajj/Umrah and advised for hostels and some travel.');
    else if (has('immuno')) add('mening', 'maybe', 'Weak immunity may need extra protection. Ask a doctor.');

    out.sort(function (x, y) { return (x.tier === 'must' ? 0 : 1) - (y.tier === 'must' ? 0 : 1); });
    return out;
  }

  /* ---------------- screens ---------------- */
  var app = $('#kyv-app');
  var STEPS = ['about', 'health', 'contact'];

  function chips(group, list, selected, multi) {
    return '<div class="kyv-chips" role="' + (multi ? 'group' : 'radiogroup') + '" data-group="' + group + '">' +
      list.map(function (o) {
        var on = multi ? selected.indexOf(o.id) > -1 : selected === o.id;
        return '<button type="button" class="kyv-chip' + (on ? ' is-on' : '') + '" role="' + (multi ? 'checkbox' : 'radio') +
          '" aria-checked="' + on + '" data-group="' + group + '" data-val="' + esc(o.id) + '">' + esc(o.label) + '</button>';
      }).join('') + '</div>';
  }
  function progress(step) {
    var idx = STEPS.indexOf(step);
    return '<div class="kyv-progress"><span class="kyv-count">Step ' + (idx + 1) + ' of ' + STEPS.length + '</span>' +
      '<div class="kyv-bar"><span style="width:' + Math.round(((idx + 1) / STEPS.length) * 100) + '%"></span></div></div>';
  }
  function nav(nextLabel, nextOk, nextType) {
    return '<div class="kyv-nav"><button type="button" class="kyv-btn-ghost" data-act="back">&#8592; Back</button>' +
      '<button type="' + (nextType || 'button') + '" class="kyv-btn"' + (nextType ? '' : ' data-act="next"') + (nextOk ? '' : ' disabled') + '>' +
      esc(nextLabel) + ' &#8594;</button></div>';
  }
  function aiChip(text) { return '<span class="kyv-ai">' + SPARK + esc(text || C.ai_badge) + '</span>'; }

  function renderIntro() {
    var c = C.intro;
    return '<div class="kyv-screen kyv-intro">' + aiChip() +
      '<div class="kyv-banner">' +
      '<div class="kyv-banner-art" aria-hidden="true"><span class="kyv-b1">' + icon('shield', 40) + '</span><span class="kyv-b2">' + SPARK + '</span><span class="kyv-b3">' + SPARK + '</span></div>' +
      '<h1 class="kyv-banner-title">' + esc(c.banner_title) + '</h1><p class="kyv-banner-sub">' + esc(c.banner_sub) + '</p></div>' +
      '<p class="kyv-lede">' + esc(c.lede) + '</p>' +
      '<button type="button" class="kyv-btn kyv-btn-lg" data-act="begin">' + esc(c.cta) + ' &#8594;</button>' +
      '<ul class="kyv-ticks">' + c.ticks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
  }
  function renderAbout() {
    var c = C.steps.about;
    return '<div class="kyv-screen">' + progress('about') + '<h2 class="kyv-q">' + esc(c.title) + '</h2>' +
      '<div class="kyv-panel"><div class="kyv-label">' + esc(c.age_label) + '</div>' + chips('age', C.ages, state.age) +
      '<div class="kyv-label">' + esc(c.gender_label) + '</div>' + chips('gender', C.genders, state.gender) + '</div>' +
      nav('Next', state.age && state.gender) + '</div>';
  }
  function renderHealth() {
    var vis = (C.flags || []).filter(flagVisible);
    state.flags = state.flags.filter(function (f) { return vis.some(function (v) { return v.id === f; }); });
    var c = C.steps.health;
    return '<div class="kyv-screen">' + progress('health') + '<h2 class="kyv-q">' + esc(c.title) + '</h2><p class="kyv-hint">' + esc(c.hint) + '</p>' +
      '<div class="kyv-panel">' + chips('flags', vis, state.flags, true) + '</div>' + nav('Next', state.flags.length) + '</div>';
  }
  function renderContact() {
    var c = C.steps.contact;
    return '<div class="kyv-screen">' + progress('contact') + '<h2 class="kyv-q">' + esc(c.title) + '</h2><p class="kyv-hint">' + esc(c.hint) + '</p>' +
      '<form class="kyv-panel kyv-form" id="kyv-form" novalidate>' +
      '<label class="kyv-input"><span>Name <i>*</i></span><input id="kyv-name" type="text" autocomplete="name" maxlength="60" value="' + esc(state.name) + '" placeholder="Your name"></label>' +
      '<p class="kyv-ferr" id="kyv-name-error">Please enter your name</p>' +
      '<label class="kyv-input"><span>Mobile number <i>*</i></span><span class="kyv-phone"><b>+91</b><input id="kyv-phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" value="' + esc(state.phone) + '" placeholder="10-digit number"></span></label>' +
      '<p class="kyv-ferr" id="kyv-phone-error">Please enter a valid 10-digit mobile number</p>' +
      '<input type="text" id="kyv-hp" tabindex="-1" autocomplete="off" class="kyv-hp" aria-hidden="true">' +
      '<label class="kyv-consent"><input type="checkbox" id="kyv-consent"' + (state.consent ? ' checked' : '') + '><span>' + esc(c.consent) + '</span></label>' +
      (S.allow_skip_contact ? '<button type="button" class="kyv-link" data-act="skip">Skip for now</button>' : '') +
      '</form>' + nav(c.cta, true).replace('data-act="next"', 'data-act="submit"') + '</div>';
  }
  function renderThinking() {
    var L = C.loading;
    return '<div class="kyv-screen kyv-thinking">' +
      '<div class="kyv-orb" aria-hidden="true">' + SPARK + '</div>' +
      '<h2 class="kyv-q">' + esc(L.title) + '</h2>' +
      '<ul class="kyv-think-list">' + L.lines.map(function (l, i) { return '<li style="animation-delay:' + (i * 0.5) + 's">' + esc(l) + '</li>'; }).join('') + '</ul></div>';
  }
  function renderNotEligible() {
    var c = C.adult_only;
    return '<div class="kyv-screen kyv-center kyv-card">' +
      '<div class="kyv-badge-icon" aria-hidden="true">' + icon('shield', 26) + '</div>' +
      '<h2 class="kyv-q">' + esc(c.title) + '</h2><p class="kyv-hint">' + esc(c.body) + '</p>' +
      '<button type="button" class="kyv-btn kyv-btn-lg" data-act="adultcheck">' + esc(c.cta) + '</button>' +
      '<button type="button" class="kyv-link" data-act="editabout">' + esc(c.edit) + '</button></div>';
  }
  /* Brand option with product data: PharmEasy cart-style row (title, price, MRP, % off).
     Out of stock -> Notify Me (saved to the sheet); in stock -> Book now. */
  function productCard(v, o) {
    var p = o.product, off = p.mrp > p.price ? Math.round((p.mrp - p.price) / p.mrp * 100) : 0;
    var asked = state.notify.indexOf(o.name) > -1;
    var btn = p.in_stock
      ? '<a class="kyv-prod-btn is-buy" href="' + esc(optionUrl(o)) + '" data-act="option" data-id="' + v.id + '" data-name="' + esc(o.name) + '">' + esc(R.buy) + '</a>'
      : (asked ? '<span class="kyv-prod-btn is-done">&#10003; ' + esc(R.notified) + '</span>'
        : '<button type="button" class="kyv-prod-btn" data-act="notify" data-id="' + v.id + '" data-name="' + esc(o.name) + '">' + esc(R.notify) + '</button>');
    return '<div class="kyv-prod">' +
      '<div class="kyv-prod-top"><p class="kyv-prod-title">' + esc(p.title) + '</p>' +
      (p.image ? '<img class="kyv-prod-img" src="' + esc(p.image) + '" alt="" width="56" height="56" loading="lazy">' : '') + '</div>' +
      '<div class="kyv-prod-foot"><div class="kyv-prod-price"><b>' + rupees(p.price) + '</b>' +
      (off ? '<s>' + rupees(p.mrp) + '</s><em>' + off + '% OFF</em>' : '') + '</div>' + btn + '</div></div>';
  }
  function vaccineCard(r) {
    var v = BY_ID[r.id];
    var pill = r.tier === 'must' ? '<span class="kyv-pill is-must">Recommended</span>' : '<span class="kyv-pill is-maybe">Ask a doctor</span>';
    return '<article class="kyv-vcard">' +
      '<div class="kyv-vtop"><span class="kyv-vicon">' + icon(v.icon) + '</span><div class="kyv-vhead"><h3 class="kyv-vname">' + esc(v.name) + '</h3>' + pill + '</div></div>' +
      '<div class="kyv-vrow"><div class="kyv-vlabel">' + esc(R.why_label) + '</div><p>' + esc(r.reason) + '</p></div>' +
      '<div class="kyv-vrow"><div class="kyv-vlabel">' + esc(R.schedule_label) + '</div><p class="kyv-sched">' + esc(v.doses) + '</p></div>' +
      '<div class="kyv-vrow"><div class="kyv-vlabel">' + esc(R.options_label) + '</div>' +
      '<div class="kyv-opts">' +
      (v.options || []).map(function (o) {
        return '<a class="kyv-opt" href="' + esc(optionUrl(o)) + '" target="_blank" rel="noopener" data-act="option" data-id="' + v.id + '" data-name="' + esc(o.name) + '">' + esc(o.name) + icon('arrow', 14) + '</a>';
      }).join('') + '</div></div>' +
      '<div class="kyv-vfoot"><span class="kyv-price">Starts at <b>' + rupees(v.price) + '</b></span>' +
      '<a class="kyv-book" href="' + esc(withSrc(v.url)) + '" data-act="book" data-id="' + v.id + '">' + esc(R.book) + '</a></div></article>';
  }
  function renderResults() {
    var first = state.name ? esc(state.name.split(' ')[0]) : '';
    var title = first ? 'Hi ' + first + ', ' + esc(R.title) : esc(R.title.charAt(0).toUpperCase() + R.title.slice(1));
    return '<div class="kyv-screen kyv-results">' +
      '<div class="kyv-res-head">' + aiChip(R.eyebrow) +
      '<h2 class="kyv-res-title">' + title + '</h2><p class="kyv-hint">' + esc(R.sub) + '</p></div>' +
      '<div class="kyv-vlist">' + state.plan.map(vaccineCard).join('') + '</div>' +
      '<div class="kyv-extra">' +
      '<div class="kyv-card kyv-center kyv-callback"><div class="kyv-badge-icon" aria-hidden="true">' + icon('phone', 22) + '</div>' +
      '<h3>' + esc(R.callback_title) + '</h3><p class="kyv-hint">' + esc(R.callback_body) + '</p>' +
      (state.callback ? '<p class="kyv-ok">' + esc(R.callback_done) + '</p>'
        : '<button type="button" class="kyv-btn kyv-btn-lg kyv-btn-dark" data-act="callback">' + esc(R.callback_cta) + '</button>') +
      '<a class="kyv-link" href="' + esc(withSrc(C.doctor.url)) + '" data-act="doctor" data-from="results">' + esc(R.doctor_cta) + '</a></div>' +
      '<div class="kyv-card kyv-center"><h3>' + esc(R.feedback_title) + '</h3>' +
      (state.feedback ? '<p class="kyv-ok">' + esc(R.feedback_done) + '</p>'
        : '<div class="kyv-fb"><button type="button" class="kyv-btn-ghost" data-act="feedback" data-val="like">' + icon('up', 18) + ' Like</button>' +
          '<button type="button" class="kyv-btn-ghost" data-act="feedback" data-val="dislike">' + icon('down', 18) + ' Dislike</button></div>') + '</div>' +
      '</div>' +
      '<div class="kyv-res-links"><button type="button" class="kyv-btn-ghost" data-act="family">' + esc(R.family) + '</button>' +
      '<button type="button" class="kyv-btn-ghost" data-act="restart">&#8592; ' + esc(R.restart) + '</button></div>' +
      '<p class="kyv-note">' + esc(C.disclaimer) + '</p></div>';
  }
  function render() {
    if (!app) return;
    var s = state.step;
    app.innerHTML = s === 'intro' ? renderIntro() : s === 'about' ? renderAbout() : s === 'health' ? renderHealth()
      : s === 'contact' ? renderContact() : s === 'thinking' ? renderThinking() : s === 'noteligible' ? renderNotEligible() : renderResults();
    app.setAttribute('data-step', s);
    if (s === 'contact') wireForm();
  }
  function scrollToApp() {
    var top = app.getBoundingClientRect().top + window.pageYOffset - 64;
    if (Math.abs(window.pageYOffset - top) > 30) window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function go(step) { state.step = step; render(); scrollToApp(); }

  function finish() {
    state.plan = recommend();
    if (!state.lead_id) state.status = 'skipped_contact';
    go('thinking');
    setTimeout(function () {
      go('results');
      dl('kyv_plan_view', { must_count: state.plan.filter(function (r) { return r.tier === 'must'; }).length, total_count: state.plan.length });
    }, reduceMotion ? 300 : 1900);
  }

  /* ---------------- contact form ---------------- */
  function isValidPhone(v) {
    if (!/^[6-9][0-9]{9}$/.test(v) || /^(\d)\1{9}$/.test(v)) return false;
    var asc = true, desc = true;
    for (var i = 1; i < v.length; i++) {
      var d = +v.charAt(i), p = +v.charAt(i - 1);
      if (d !== (p + 1) % 10) asc = false;
      if (d !== (p + 9) % 10) desc = false;
    }
    return !(asc || desc);
  }
  function fieldErr(id, on) {
    var i = $('#' + id), e = $('#' + id + '-error');
    if (i) i.classList.toggle('is-invalid', on);
    if (e) e.classList.toggle('is-show', on);
  }
  function submitContact() {
    var phone = $('#kyv-phone'), name = $('#kyv-name');
    var n = name.value.trim(), p = phone.value.trim();
    var nOk = n.length >= 2 && /[a-zA-Zऀ-ॿ]/.test(n), pOk = isValidPhone(p);
    fieldErr('kyv-name', !nOk); fieldErr('kyv-phone', !pOk);
    if (!nOk) { name.focus(); return; }
    if (!pOk) { phone.focus(); return; }
    state.name = n; state.phone = p; state.consent = $('#kyv-consent').checked;
    state.lead_id = uid('KYV-');
    state.plan = recommend();
    state.status = 'lead';
    var value = state.plan.filter(function (r) { return r.tier === 'must'; }).reduce(function (s, r) { return s + BY_ID[r.id].price; }, 0);
    // Ad platforms get the conversion and phone (Enhanced Conversions) but never the health answers.
    dl('generate_lead', { lead_id: state.lead_id, form_name: 'know_your_vaccine', value: value, currency: 'INR', user_data: { phone_number: '+91' + p } });
    if (window.fbq) window.fbq('track', 'Lead', { content_name: 'Know Your Vaccine', value: value, currency: 'INR' }, { eventID: state.lead_id });
    sync('lead_submitted', '', { retries: 3 }).then(function (d) { if (d) cleverTap(p); });
    finish();
  }
  function wireForm() {
    var form = $('#kyv-form'), phone = $('#kyv-phone'), name = $('#kyv-name');
    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '');
      if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
      else if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
      d = d.slice(0, 10); if (phone.value !== d) phone.value = d;
      fieldErr('kyv-phone', false);
    });
    name.addEventListener('input', function () { fieldErr('kyv-name', false); });
    form.addEventListener('submit', function (e) { e.preventDefault(); submitContact(); });
  }
  function cleverTap(mobile) {
    if (!window.clevertap) return;
    var e164 = '+91' + mobile;
    window.clevertap.onUserLogin.push({ Site: { Identity: e164, Phone: e164 } });
    window.clevertap.event.push('Lead Submitted', { source: 'p_leadgen', element_unique_name: 'kyv_finder_form', source_url: location.href, lead_status: 'success' });
  }

  /* ---------------- events ---------------- */
  function onChip(btn) {
    var g = btn.getAttribute('data-group'), v = btn.getAttribute('data-val');
    markStart();
    if (g === 'flags') {
      if (v === 'none') state.flags = state.flags.indexOf('none') > -1 ? [] : ['none'];
      else {
        state.flags = state.flags.filter(function (f) { return f !== 'none'; });
        var i = state.flags.indexOf(v); if (i > -1) state.flags.splice(i, 1); else state.flags.push(v);
      }
    } else state[g] = v;
    render();
  }
  function onNext() {
    if (state.step === 'about') {
      if (!(state.age && state.gender)) return;
      if (isMinor()) {
        state.status = 'not_eligible';
        dl('kyv_not_eligible', { reason: 'under_18' });
        sync('not_eligible', 'under_18');
        go('noteligible');
        return;
      }
      state.status = 'about_done';
      dl('kyv_step', { step: 'about', step_number: 1 });
      sync('about_completed');
      go('health');
    } else if (state.step === 'health') {
      if (!state.flags.length) return;
      state.status = 'health_done';
      dl('kyv_step', { step: 'health', step_number: 2 });
      sync('health_completed');
      if (state.lead_id) { state.status = 'family_plan'; finish(); sync('family_plan_viewed'); }
      else go('contact');
    }
  }
  function onBack() {
    var i = STEPS.indexOf(state.step);
    go(i > 0 ? STEPS[i - 1] : 'intro');
  }
  function resetAnswers(family) {
    var prev = state;
    state = freshState(); state.step = 'about'; state.started_at = Date.now();
    if (family && prev.lead_id) {
      state.family_of = prev.family_of || prev.lead_id; state.lead_id = uid('KYV-');
      state.name = prev.name; state.phone = prev.phone; state.consent = prev.consent;
    }
    render(); scrollToApp();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act], .kyv-chip') : null;
    if (!t) return;
    if (t.classList.contains('kyv-chip')) { onChip(t); return; }
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    if (act === 'begin' || act === 'startcheck') {
      if (act === 'startcheck') e.preventDefault();
      markStart(); dl(act === 'begin' ? 'kyv_begin' : 'kyv_sticky_click');
      if (state.step === 'intro') go('about'); else scrollToApp();
    }
    else if (act === 'next') onNext();
    else if (act === 'submit') submitContact();
    else if (act === 'back') onBack();
    else if (act === 'skip') { state.status = 'skipped_contact'; dl('kyv_skip_contact'); sync('contact_skipped'); finish(); }
    else if (act === 'option') {
      var nm = t.getAttribute('data-name');
      if (state.options.indexOf(nm) < 0) state.options.push(nm);
      dl('kyv_option_click', { vaccine: id, option: nm });
      sync('option_click', id + ':' + nm, { beacon: true });
    }
    else if (act === 'notify') {
      var on = t.getAttribute('data-name');
      if (state.notify.indexOf(on) < 0) state.notify.push(on);
      dl('kyv_notify_me', { vaccine: id, option: on });
      sync('notify_me', id + ':' + on, { retries: 3 });
      var y = window.pageYOffset; render(); window.scrollTo(0, y);
    }
    else if (act === 'book') {
      if (state.booked.indexOf(id) < 0) state.booked.push(id);
      var v = BY_ID[id];
      dl('order_now_click', { vaccine: id, source: 'results', value: v ? v.price : 0, currency: 'INR' });
      sync('book_click', id, { beacon: true });
    }
    else if (act === 'callback') {
      state.callback = true; dl('kyv_callback_request'); sync('callback_request', '', { retries: 3 }); render();
    }
    else if (act === 'feedback') {
      state.feedback = t.getAttribute('data-val'); dl('kyv_feedback', { value: state.feedback }); sync('feedback', state.feedback); render();
    }
    else if (act === 'doctor') { state.doctor_click = true; dl('talk_to_doctor_click'); sync('doctor_click', t.getAttribute('data-from') || 'results', { beacon: true }); }
    else if (act === 'restart') { dl('kyv_restart'); resetAnswers(false); }
    else if (act === 'adultcheck') { dl('kyv_restart', { from: 'not_eligible' }); resetAnswers(!!state.family_of); }
    else if (act === 'family') { dl('kyv_family_check'); resetAnswers(true); }
    else if (act === 'editabout') { state.status = 'started'; go('about'); }
  });

  /* ---------------- chrome: nav, sticky bar ---------------- */
  (function lockup() {
    // Inside the app (mweb) the lockup must not navigate to the website; on desktop it links to pharmeasy.in.
    var logo = $('.pe-logo'); if (!logo || isDesktop) return;
    logo.setAttribute('tabindex', '-1'); logo.setAttribute('aria-disabled', 'true');
    logo.addEventListener('click', function (e) { e.preventDefault(); });
  })();
  (function navMenu() {
    var burger = $('.pe-burger'), menu = $('#pe-topnav');
    if (burger && menu) burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', open);
    });
    $all('.pe-nav-btn').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = b.parentNode, was = item.classList.contains('open');
        $all('.pe-nav-item.open').forEach(function (x) { x.classList.remove('open'); });
        if (!was) { item.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.pe-nav-item')) $all('.pe-nav-item.open').forEach(function (x) { x.classList.remove('open'); });
    });
  })();
  (function sticky() {
    var bar = $('#kyv-sticky'); if (!bar || !app || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (en) {
      bar.classList.toggle('is-show', !en[0].isIntersecting && state.step !== 'results' && state.step !== 'thinking');
    }, { threshold: 0 }).observe(app);
  })();

  render();
})();
