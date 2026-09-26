// DOM side of Callina: finds prices in the page, inserts badges, shows the tooltip.
// Never rewrites page text — it only splits text nodes and inserts <callina-badge> after prices.
(function () {
  'use strict';
  const CL = globalThis.Callina;
  if (!CL || !CL.parser || CL.scannerStarted || !document.documentElement) return;
  CL.scannerStarted = true;

  const { parser, convert: CV, cats, settings: S } = CL;
  const SITE = S.siteKey(location.hostname);
  const TLD = parser.tldOf(location.hostname);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DIGIT = /\d/;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE',
    'TEMPLATE', 'IFRAME', 'CANVAS', 'KBD', 'SAMP', 'MATH', 'CALLINA-BADGE', 'CALLINA-TIP']);
  const SKIP_SELECTOR = 'script,style,noscript,textarea,input,select,option,code,pre,svg,template,' +
    '[contenteditable]:not([contenteditable="false"]),[data-callina]';
  // Screen-reader-only copies of prices (e.g. Amazon's .a-offscreen) would double the badges.
  const HIDDEN_CLASS = /\b(?:a-offscreen|sr-only|visually-?hidden|visuallyhidden|screen-?reader-(?:text|only))\b/i;
  const INLINE_TAGS = new Set(['SPAN', 'B', 'STRONG', 'EM', 'I', 'SMALL', 'SUP', 'SUB', 'A', 'LABEL', 'BDI', 'BDO',
    'INS', 'DEL', 'S', 'U', 'FONT', 'DATA', 'ABBR', 'MARK', 'BIG', 'TIME']);

  let settings = S.normalizeSettings({});
  let rates = null; // { table, date, fetchedAt, source }
  let customUrls = {}; // "custom:<id>" → data URL, only for uploads currently in use
  let customsLoaded = null; // promise; uploads are read on the first hover, not on every page load
  let pageCurrency = null;
  let ctx = {};
  let running = false;
  let sawDollar = false;
  // All per-node state lives here, not in DOM attributes or expandos the page could read or forge.
  let processed = new WeakSet(); // text nodes + split-price elements already handled
  let splitEls = new WeakSet(); // elements whose combined text got one badge
  let rests = new WeakSet(); // text nodes we split off; rejoined on stop()
  let added = new WeakMap(); // owner node → nodes we inserted next to it
  const badges = new WeakMap(); // our badge host → { pill, amount, high, currency, via, marker }

  // ---- styles ---------------------------------------------------------------
  const BADGE_CSS = `
.pill{display:inline;white-space:normal;margin:0 0 0 .35em;padding:.06em .45em;border-radius:999px;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:clamp(10px,.8em,15px);font-weight:500;
  font-style:normal;font-variant:normal;letter-spacing:0;word-spacing:normal;text-transform:none;text-decoration:none;
  text-shadow:none;line-height:inherit;vertical-align:baseline;cursor:help;box-shadow:none;
  -webkit-box-decoration-break:clone;box-decoration-break:clone}
.pill>span{white-space:nowrap}
.pill.subtle{color:inherit;background:rgba(246,170,75,.16);border:1px solid rgba(246,170,75,.6)}
.pill.bold{color:#2A1703;background:#F6AA4B;border:1px solid #C47A1E;font-weight:650}`;

  const TIP_CSS = `
.card{box-sizing:border-box;display:flex;gap:10px;align-items:center;width:max-content;max-width:290px;padding:10px 12px;
  border-radius:12px;background:#FFFDF8;color:#231A10;border:1px solid #F0D2A6;box-shadow:0 8px 28px rgba(40,25,5,.22);
  font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;text-align:left;
  opacity:0;transition:opacity .12s ease}
.card.show{opacity:1}
.cat{flex:none;width:68px;height:68px}
.info{min-width:0}
.mood{display:inline-block;margin:0 0 3px;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:700;
  letter-spacing:.04em;text-transform:uppercase;background:#F2EEE6;color:#5E4F3C}
.mood[data-mood=pocket]{background:#D9F7E3;color:#17693A}.mood[data-mood=treat]{background:#DDF0FF;color:#135C8A}
.mood[data-mood=pricey]{background:#FFEFCC;color:#8A5A00}.mood[data-mood=ouch]{background:#FFE0D3;color:#A33A12}
.mood[data-mood=nope]{background:#FFD6DD;color:#A0142E}
.say{position:relative;display:block;width:max-content;max-width:100%;box-sizing:border-box;margin:1px 0 6px 6px;
  padding:4px 10px;border-radius:12px;background:#fff;border:1.5px solid #E7C99C;font-weight:650;font-size:12.5px;line-height:1.3}
.say::before{content:"";position:absolute;left:-8px;top:50%;margin-top:-6px;border:6px solid transparent;border-left:0;
  border-right:8px solid #E7C99C}
.card.show .say{animation:say-pop .28s cubic-bezier(.2,1.6,.4,1)}
@keyframes say-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.orig{font-weight:600}.orig small{font-weight:400;color:#86705A;margin-left:4px}
.conv{font-size:16px;font-weight:700;margin:1px 0}
.rate,.via{font-size:11px;color:#86705A}
.work{font-size:12.5px;color:#B15F00;font-weight:600;margin-top:3px}
@media (prefers-color-scheme:dark){
  .card{background:#241D16;color:#F7EBDC;border-color:#5A4127}
  .orig small,.rate,.via{color:#C4AB8E}.work{color:#FFB757}
  .say{background:#33291F;border-color:#6B4F2E}.say::before{border-right-color:#6B4F2E}}
@media (prefers-reduced-motion:reduce){.card{transition:none}.card.show .say{animation:none}}`;

  const sheetCache = new Map();
  function addStyles(root, css) {
    try {
      let sheet = sheetCache.get(css);
      if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(css); sheetCache.set(css, sheet); }
      root.adoptedStyleSheets = [sheet];
    } catch (_) {
      const style = document.createElement('style');
      style.textContent = css;
      root.appendChild(style);
    }
  }

  // ---- context for resolving ambiguous symbols --------------------------------
  function detectPageCurrency() {
    const sel = '[itemprop="priceCurrency"],meta[property="product:price:currency"],meta[property="og:price:currency"]';
    for (const el of document.querySelectorAll(sel)) {
      const v = (el.getAttribute('content') || el.textContent || '').trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(v)) return v;
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const c = parser.currencyFromJsonLd(JSON.parse(script.textContent));
        if (c) return c;
      } catch (_) { /* invalid JSON-LD on the page */ }
    }
    return null;
  }

  function buildCtx() {
    return {
      homeCurrency: settings.homeCurrency,
      pageCurrency,
      dollarOverride: settings.dollarOverrides[SITE] || null,
      tld: TLD,
    };
  }

  // ---- badges -------------------------------------------------------------------
  function compute(amount, high, currency) {
    const home = settings.homeCurrency;
    const table = rates && rates.table;
    const v = CV.convert(amount, currency, home, table);
    if (v == null) return null;
    const vh = high != null ? CV.convert(high, currency, home, table) : null;
    const hourly = CV.hourlyRate(settings.income, home, table);
    const hours = hourly ? CV.hoursNeeded(vh != null ? vh : v, hourly) : null;
    const usd = CV.convert(high != null ? high : amount, currency, 'USD', table);
    return { v, vh, hours, usd };
  }

  function renderBadge(host) {
    const { amount, high, currency, pill } = badges.get(host);
    const r = currency === settings.homeCurrency ? null : compute(amount, high, currency);
    if (!r) { host.hidden = true; return; }
    host.hidden = false;
    pill.className = 'pill ' + (settings.display.style === 'bold' ? 'bold' : 'subtle');
    const text = CV.badgeText({
      home: r.v, homeHigh: r.vh, homeCurrency: settings.homeCurrency, hours: r.hours,
      income: settings.income, display: settings.display,
    });
    // Money and work time each stay on one line, but may wrap between them in narrow boxes.
    const [money, work] = text.split(' · ');
    pill.textContent = '';
    const m = document.createElement('span');
    m.textContent = money;
    pill.appendChild(m);
    if (work) {
      const w = document.createElement('span');
      w.textContent = '· ' + work;
      pill.append(' ', w); // this space is the only line-break opportunity
    }
  }

  function makeBadge(p) {
    const host = document.createElement('callina-badge');
    host.setAttribute('data-callina', '');
    host.tabIndex = 0; // keyboard users can focus a badge to read its tooltip
    const root = host.attachShadow({ mode: 'closed' });
    addStyles(root, BADGE_CSS);
    const pill = document.createElement('span');
    root.appendChild(pill);
    badges.set(host, {
      pill, amount: p.amount, high: p.amountHigh != null ? p.amountHigh : null,
      currency: p.currency, via: p.via, marker: p.marker,
    });
    // Only real user input opens the tooltip; pages can't trigger it with synthetic events.
    host.addEventListener('pointerenter', (e) => { if (e.isTrusted && e.pointerType === 'mouse') showTip(host); });
    host.addEventListener('pointerleave', (e) => { if (e.isTrusted && e.pointerType === 'mouse') hideTip(); });
    // Keyboard focus only; a tap also focuses the badge, and the click handler below owns that case.
    host.addEventListener('focus', (e) => { if (e.isTrusted && host.matches(':focus-visible')) showTip(host); });
    host.addEventListener('blur', hideTip);
    host.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
    host.addEventListener('click', (e) => {
      if (!e.isTrusted || lastPointer === 'mouse') return;
      // Touch/pen: a tap toggles the tooltip instead of following a surrounding link.
      e.preventDefault();
      e.stopPropagation();
      if (tipBadge === host) hideTip(); else showTip(host);
    });
    renderBadge(host);
    return host;
  }

  // Only badges we made (a page could add look-alike elements).
  function ourBadges() {
    return [...document.querySelectorAll('callina-badge[data-callina]')].filter((b) => badges.has(b));
  }

  function rerenderAll() {
    for (const b of ourBadges()) renderBadge(b);
    if (tip) tip.cat.dataset.mascot = ''; // refill on next hover
  }

  // Remember nodes we added next to `owner`, so they can be removed if the page changes it.
  function track(owner, node) {
    const list = added.get(owner);
    if (list) list.push(node); else added.set(owner, [node]);
  }

  function dropAdded(owner) {
    const list = added.get(owner);
    if (!list) return;
    for (const n of list) if (n.parentNode) n.parentNode.removeChild(n);
    added.delete(owner);
  }

  // ---- tooltip --------------------------------------------------------------
  let tip = null;
  let tipBadge = null; // the badge the tooltip is showing
  let tipToken = 0; // bumps on every show/hide, so a stale async show gives up
  let lastPointer = 'mouse';
  const VIA_TEXT = { page: 'from the page', override: 'your setting for this site', tld: "from the site's domain", default: 'default' };

  function setImportant(el, props) {
    for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v, 'important');
  }

  function ensureTip() {
    if (tip && tip.host.isConnected) return tip;
    const host = document.createElement('callina-tip');
    host.setAttribute('data-callina', '');
    // content.css resets the host with `all: initial`; inline !important wins over that.
    setImportant(host, {
      position: 'fixed', left: '0px', top: '0px', 'z-index': '2147483647', 'pointer-events': 'none', display: 'none',
    });
    const root = host.attachShadow({ mode: 'closed' });
    addStyles(root, TIP_CSS + cats.CSS);
    const card = document.createElement('div');
    card.className = 'card';
    const cat = cats.create(document, settings.mascot, 'idle', customUrls[settings.mascot]);
    const catBox = document.createElement('div');
    catBox.className = 'cat';
    catBox.appendChild(cat);
    const info = document.createElement('div');
    info.className = 'info';
    const line = (cls) => { const d = document.createElement('div'); d.className = cls; info.appendChild(d); return d; };
    const mood = line('mood');
    const say = line('say');
    const orig = line('orig');
    const conv = line('conv');
    const rate = line('rate');
    const via = line('via');
    const work = line('work');
    card.append(catBox, info);
    root.appendChild(card);
    document.documentElement.appendChild(host);
    tip = { host, card, cat, mood, say, orig, conv, rate, via, work };
    return tip;
  }

  async function showTip(badge) {
    const token = ++tipToken;
    tipBadge = badge;
    await ensureCustomCats();
    if (token !== tipToken || !badge.isConnected) return;
    const { amount, high, currency, via, marker } = badges.get(badge);
    const r = compute(amount, high, currency);
    if (!r) return;
    const t = ensureTip();
    const home = settings.homeCurrency;
    const curName = Object.hasOwn(CL.CURRENCIES, currency) ? CL.CURRENCIES[currency].name : '';

    t.orig.textContent = CV.formatOriginal(amount, currency, high);
    if (curName) { const s = document.createElement('small'); s.textContent = curName; t.orig.appendChild(s); }
    t.conv.textContent = '≈ ' + (r.vh != null
      ? `${CV.formatPrecise(r.v, home)} – ${CV.formatPrecise(r.vh, home)}`
      : CV.formatPrecise(r.v, home));
    const rateVal = CV.crossRate(rates.table, currency, home);
    t.rate.textContent = `${CV.formatRate(currency, home, rateVal)} · rates from ${rates.date}`;
    t.via.textContent = via && via !== 'explicit' && via !== 'default' ? `“${marker}” read as ${currency} (${VIA_TEXT[via] || via})` : '';
    t.via.hidden = !t.via.textContent;
    const hasWork = r.hours != null && CV.validIncome(settings.income);
    t.work.textContent = hasWork ? CV.formatWorkLong(r.hours, settings.income) : '';
    t.work.hidden = !hasWork;
    // Affordability mood → which cat, and which face it makes.
    const mood = CV.moodFor(r.hours, settings.income, r.usd);
    const catId = S.catForMood(settings, mood.id);
    if (t.cat.dataset.mascot !== catId) cats.fill(t.cat, catId, customUrls[catId]);
    cats.setState(t.cat, mood.expr);
    t.mood.textContent = mood.label;
    t.mood.dataset.mood = mood.id;
    t.say.textContent = CV.moodPhrase(mood); // a fresh line on every hover

    // position: below the badge, or above if there's no room
    t.host.style.setProperty('display', 'block', 'important');
    const b = badge.getBoundingClientRect();
    const c = t.card.getBoundingClientRect();
    const x = Math.max(8, Math.min(b.left, window.innerWidth - c.width - 8));
    let y = b.bottom + 8;
    if (y + c.height > window.innerHeight - 8) y = Math.max(8, b.top - c.height - 8);
    setImportant(t.host, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px` });
    t.card.classList.add('show');
  }

  function hideTip() {
    tipToken++;
    tipBadge = null;
    if (!tip) return;
    tip.card.classList.remove('show');
    tip.host.style.setProperty('display', 'none', 'important');
  }

  // ---- scanning -------------------------------------------------------------
  function acceptElement(el) {
    if (SKIP_TAGS.has(el.tagName) || el.namespaceURI === SVG_NS) return false;
    if (el.hasAttribute('data-callina')) return false;
    const ce = el.getAttribute('contenteditable');
    if (ce !== null && ce !== 'false') return false;
    const cls = el.getAttribute('class');
    return !(cls && HIDDEN_CLASS.test(cls));
  }

  function rootAllowed(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !!el && el.isConnected && !el.closest(SKIP_SELECTOR) && (node.nodeType !== 1 || acceptElement(node));
  }

  function collectTextNodes(root, out) {
    if (!root || !root.isConnected || !rootAllowed(root)) return;
    if (root.nodeType === 3) {
      if (!processed.has(root) && DIGIT.test(root.data)) out.push(root);
      return;
    }
    if (root.nodeType !== 1) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === 1) return acceptElement(n) ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_REJECT;
        return !processed.has(n) && DIGIT.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
  }

  function textNodesOf(el) {
    const out = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n);
    return out;
  }

  // Combined text of a split price; "<span>$49</span><sup>99</sup>" → "$49.99".
  function combinedText(texts) {
    let s = '';
    for (const n of texts) {
      const d = n.data;
      const p = n.parentElement;
      if (p && p.closest('sup') && /^\s*\d{2}\s*$/.test(d) && /\d$/.test(s.trim())) s = s.trimEnd() + '.' + d.trim();
      else s += d;
    }
    return s;
  }

  // §5.5: small element whose combined text is exactly one price. Outermost one wins.
  function findSplit(t) {
    let best = null;
    let el = t.parentElement;
    for (let depth = 0; el && depth < 4; depth++, el = el.parentElement) {
      if (el === document.body || el === document.documentElement) break;
      if (splitEls.has(el)) return { el, done: true };
      if (!acceptElement(el)) break;
      if (el.textContent.length > 30) break;
      if (el.getElementsByTagName('*').length >= 6) break;
      if (el.querySelector('callina-badge')) break;
      const texts = textNodesOf(el);
      if (texts.filter((n) => n.data.trim()).length < 2) continue;
      const price = parser.exactPrice(combinedText(texts), ctx);
      if (price) best = { el, price, texts };
    }
    return best;
  }

  function convertible(p) {
    return !p.isHome && rates && CV.crossRate(rates.table, p.currency, settings.homeCurrency) != null;
  }

  function processTextNode(t) {
    if (processed.has(t) || !t.parentNode || !t.isConnected) return;

    const split = findSplit(t);
    if (split) {
      processed.add(t);
      if (split.done) return;
      const { el, price, texts } = split;
      splitEls.add(el);
      processed.add(el);
      for (const n of texts) processed.add(n);
      if (price.ambiguous === 'DOLLAR') sawDollar = true;
      if (!convertible(price)) return;
      const badge = makeBadge(price);
      if (INLINE_TAGS.has(el.tagName)) el.after(badge);
      else el.appendChild(badge);
      track(el, badge);
      return;
    }

    processed.add(t);
    const prices = parser.findPrices(t.data, ctx);
    if (!prices.length) return;
    if (prices.some((p) => p.ambiguous === 'DOLLAR')) sawDollar = true;
    const todo = prices.filter(convertible);
    // Right-to-left so earlier offsets stay valid while we split.
    for (let i = todo.length - 1; i >= 0; i--) {
      const p = todo[i];
      if (p.end < t.data.length) {
        const rest = t.splitText(p.end);
        processed.add(rest);
        rests.add(rest);
        track(t, rest);
      }
      const badge = makeBadge(p);
      t.after(badge);
      track(t, badge);
    }
  }

  // ---- chunked work queue ----------------------------------------------------
  const roots = [];
  let texts = [];
  let textIdx = 0;
  let scheduled = false;
  const ric = window.requestIdleCallback
    ? (fn) => window.requestIdleCallback(fn, { timeout: 800 })
    : (fn) => setTimeout(() => fn(null), 16);

  function schedule() {
    if (scheduled || !running) return;
    scheduled = true;
    ric(work);
  }

  function work(deadline) {
    scheduled = false;
    if (!running) return;
    const start = performance.now();
    const hasTime = () => (deadline && !deadline.didTimeout ? deadline.timeRemaining() > 2 : performance.now() - start < 12);
    let did = 0;
    while (did === 0 || hasTime()) {
      if (textIdx < texts.length) {
        try { processTextNode(texts[textIdx]); } catch (e) { /* never break the page */ }
        textIdx++;
      } else if (roots.length) {
        texts = [];
        textIdx = 0;
        collectTextNodes(roots.shift(), texts);
      } else break;
      did++;
    }
    if (observer) observer.takeRecords(); // our own insertions aren't page changes
    if (textIdx < texts.length || roots.length) schedule();
  }

  // ---- mutations (SPAs, infinite scroll) ---------------------------------------
  let observer = null;
  const pending = new Set();
  let debounceTimer = null;
  let firstPendingAt = 0;

  function invalidateSplitAncestor(node) {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      if (splitEls.has(el)) {
        dropAdded(el);
        splitEls.delete(el);
        processed.delete(el);
        for (const n of textNodesOf(el)) processed.delete(n);
        pending.add(el);
        return;
      }
    }
  }

  function onMutations(records) {
    for (const r of records) {
      if (r.type === 'characterData') {
        const t = r.target;
        if (t.parentElement && t.parentElement.closest('[data-callina]')) continue;
        dropAdded(t); // our split-off tail + badge are stale now
        processed.delete(t);
        invalidateSplitAncestor(t);
        pending.add(t);
        continue;
      }
      if (r.target.nodeType === 1 && r.target.closest('[data-callina]')) continue;
      let relevant = false;
      for (const n of r.addedNodes) {
        if (n.nodeType === 1 && n.hasAttribute('data-callina')) continue;
        if (processed.has(n)) continue;
        pending.add(n);
        relevant = true;
      }
      for (const n of r.removedNodes) {
        if (n.nodeType === 1 && n.hasAttribute('data-callina')) continue;
        dropAdded(n);
        relevant = true;
      }
      if (relevant) invalidateSplitAncestor(r.target);
    }
    observer.takeRecords(); // drop records caused by our own clean-up above
    if (tipBadge && !tipBadge.isConnected) hideTip();
    if (!pending.size) return;
    // Debounce (~300 ms) but never wait more than 1 s on constantly-changing pages.
    const now = performance.now();
    if (!debounceTimer) firstPendingAt = now;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flushPending, now - firstPendingAt > 1000 ? 0 : 300);
  }

  // SPAs change the URL without reloading; the new page may declare a different currency.
  let lastHref = location.href;
  let navAt = -Infinity;
  function pageCurrencyChanged() {
    if (location.href !== lastHref) { lastHref = location.href; navAt = performance.now(); }
    if (performance.now() - navAt > 3000) return false; // keep looking briefly: metadata often arrives late
    const pc = detectPageCurrency();
    if (pc === pageCurrency) return false;
    pageCurrency = pc;
    return true;
  }

  function flushPending() {
    debounceTimer = null;
    if (pageCurrencyChanged()) { stop(); start(); return; } // ambiguous "$" may mean something else now
    for (const n of pending) if (n.isConnected) roots.push(n);
    pending.clear();
    schedule();
  }

  // ---- lifecycle -------------------------------------------------------------
  function shouldRun() {
    return settings.enabled && !settings.disabledSites.includes(SITE);
  }

  function start() {
    if (running || !rates || !document.body || !shouldRun()) return;
    running = true;
    ctx = buildCtx();
    roots.push(document.body);
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
  }

  function stop() {
    running = false;
    if (observer) { observer.disconnect(); observer = null; }
    clearTimeout(debounceTimer);
    debounceTimer = null;
    pending.clear();
    roots.length = 0;
    texts = [];
    textIdx = 0;
    for (const b of ourBadges()) {
      // Undo our split: "Only $10" + badge + " today" → "Only $10 today".
      const prev = b.previousSibling;
      const next = b.nextSibling;
      b.remove();
      if (prev && prev.nodeType === 3 && next && rests.has(next)) { prev.appendData(next.data); next.remove(); }
    }
    hideTip();
    processed = new WeakSet();
    splitEls = new WeakSet();
    rests = new WeakSet();
    added = new WeakMap();
    sawDollar = false;
  }

  function applySettings(prev) {
    const needRescan = !prev || prev.homeCurrency !== settings.homeCurrency ||
      (prev.dollarOverrides[SITE] || null) !== (settings.dollarOverrides[SITE] || null);
    if (!shouldRun()) { stop(); return; }
    if (running && needRescan) stop();
    if (running) rerenderAll();
    else if (rates) start();
    else requestRates().then(start);
  }

  // Uploaded images in use (the mascot, plus any assigned to a mood). Never the whole collection.
  function customIdsInUse() {
    const ids = new Set([settings.mascot]);
    if (settings.moodMode === 'squad') for (const id of Object.values(settings.moodCats)) ids.add(id);
    return [...ids].filter((id) => S.customKey(id));
  }

  async function loadCustomCats() {
    const ids = customIdsInUse();
    try {
      const got = ids.length ? await chrome.storage.local.get(ids.map(S.customKey)) : {};
      customUrls = Object.fromEntries(ids.map((id) => [id, got[S.customKey(id)] || null]));
    } catch (_) {
      customUrls = {};
    }
  }

  function ensureCustomCats() {
    return customsLoaded || (customsLoaded = loadCustomCats());
  }

  function forgetCustomCats() {
    customsLoaded = null;
    customUrls = {};
    if (tip) tip.cat.dataset.mascot = ''; // refill on next hover
  }

  async function requestRates() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'getRates' });
      if (res && res.rates && res.rates.table) rates = res.rates;
    } catch (_) { /* extension reloaded or worker unavailable */ }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      const prev = settings;
      settings = S.normalizeSettings(changes.settings.newValue);
      applySettings(prev);
      const catsChanged = prev.mascot !== settings.mascot || prev.moodMode !== settings.moodMode ||
        JSON.stringify(prev.moodCats) !== JSON.stringify(settings.moodCats);
      if (catsChanged) forgetCustomCats();
    }
    if (area === 'local' && changes.rates && changes.rates.newValue) {
      rates = changes.rates.newValue;
      if (running) rerenderAll(); else if (shouldRun()) start();
    }
    if (area === 'local' && customIdsInUse().some((id) => changes[S.customKey(id)])) forgetCustomCats();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'getPageInfo') return false;
    sendResponse({
      hostname: SITE,
      running,
      count: running ? ourBadges().filter((b) => !b.hidden).length : 0,
      hasDollar: sawDollar,
      dollarAuto: parser.resolveCurrency('$', { ...buildCtx(), dollarOverride: null }).currency,
      pageCurrency,
    });
    return false;
  });

  window.addEventListener('scroll', hideTip, { capture: true, passive: true });
  // A tap anywhere else, or Escape, closes a tooltip opened by touch or keyboard.
  document.addEventListener('pointerdown', (e) => { if (tipBadge && e.target !== tipBadge) hideTip(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); }, true);

  (async function init() {
    try {
      const { settings: stored } = await chrome.storage.sync.get('settings');
      settings = S.normalizeSettings(stored);
    } catch (_) { /* use defaults */ }
    pageCurrency = detectPageCurrency();
    if (!shouldRun()) return;
    await requestRates();
    start();
  })();
})();
