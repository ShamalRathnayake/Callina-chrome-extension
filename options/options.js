'use strict';
(async function () {
  const CL = globalThis.Callina;
  const { ui, cats, convert: CV } = CL;
  const $ = (id) => document.getElementById(id);
  const MAX_UPLOAD = 1024 * 1024;
  const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

  ui.injectCatCss();
  let settings = await ui.loadSettings();
  const MAX_CUSTOM = CL.settings.MAX_CUSTOM_CATS;
  let customs = await ui.loadCustomCats(); // [{ id, name, url }]
  let rateInfo = await chrome.runtime.sendMessage({ type: 'getRates' }).catch(() => null);
  const table = () => (rateInfo && rateInfo.rates ? rateInfo.rates.table : null);
  let previewState = 'idle';

  let savedTimer = null;
  async function save(mutator) {
    settings = await ui.saveSettings(mutator);
    $('saved').textContent = 'Saved ✓';
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { $('saved').textContent = ''; }, 1500);
    renderAll();
  }

  // ---- hero ---------------------------------------------------------------
  const heroCat = cats.create(document, settings.mascot, 'idle', (customs.find((c) => 'custom:' + c.id === settings.mascot) || {}).url);
  $('heroCat').appendChild(heroCat);

  // ---- 1. home currency --------------------------------------------------------
  let choices = ui.currencyChoices(table());
  function renderHome() {
    const q = $('homeFilter').value.trim().toLowerCase();
    const list = choices.filter(({ code, name }) =>
      !q || code.toLowerCase().includes(q) || name.toLowerCase().includes(q) || code === settings.homeCurrency);
    ui.fillCurrencySelect($('home'), list, settings.homeCurrency);
    const c = choices.find((x) => x.code === settings.homeCurrency);
    $('homeLabel').textContent = c ? `${c.code} — ${c.name}` : settings.homeCurrency;
  }
  $('homeFilter').addEventListener('input', renderHome);
  $('homeFilter').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); $('home').focus(); }
  });
  $('home').addEventListener('change', (e) => {
    const code = e.target.value;
    if (code) save((s) => { s.homeCurrency = code; });
  });

  // ---- 2. work settings --------------------------------------------------------
  function fillWork() {
    const inc = settings.income;
    $('incAmount').value = inc.amount ?? '';
    $('incHours').value = inc.hoursPerDay ?? '';
    $('incDays').value = inc.daysPerMonth ?? '';
    ui.fillCurrencySelect($('incCurrency'), choices, inc.currency);
  }

  function readWork() {
    const num = (id) => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
    return { amount: num('incAmount'), currency: $('incCurrency').value, hoursPerDay: num('incHours'), daysPerMonth: num('incDays') };
  }

  function workProblems(inc) {
    const bad = {};
    const pos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
    if (inc.amount != null && !pos(inc.amount)) bad.incAmount = 'Income must be a positive number.';
    if (inc.hoursPerDay != null && !(pos(inc.hoursPerDay) && inc.hoursPerDay <= 24)) bad.incHours = 'Hours per day must be between 0 and 24.';
    if (inc.daysPerMonth != null && !(pos(inc.daysPerMonth) && inc.daysPerMonth <= 31)) bad.incDays = 'Days per month must be between 0 and 31.';
    return bad;
  }

  function renderWorkPreview() {
    const inc = readWork();
    const bad = workProblems(inc);
    for (const id of ['incAmount', 'incHours', 'incDays']) $(id).setAttribute('aria-invalid', bad[id] ? 'true' : 'false');
    const p = $('workPreview');
    const msgs = Object.values(bad);
    if (msgs.length) { p.textContent = msgs.join(' '); p.className = 'preview err'; return; }
    const hourly = CV.hourlyRate(inc, settings.homeCurrency, table());
    if (hourly) {
      p.textContent = `Your time is worth ≈ ${CV.formatMoney(hourly, settings.homeCurrency)} / hour`;
      p.className = 'preview';
    } else {
      p.textContent = CV.validIncome(inc) ? 'Waiting for exchange rates…' : 'Fill in all three fields to show work hours. Until then they stay hidden.';
      p.className = 'preview err';
    }
  }

  let workTimer = null;
  function onWork() {
    renderWorkPreview();
    clearTimeout(workTimer);
    workTimer = setTimeout(() => {
      const inc = readWork();
      save((s) => { s.income = inc; }); // invalid values are stored but ignored everywhere
    }, 400);
  }
  for (const id of ['incAmount', 'incHours', 'incDays', 'incCurrency']) {
    $(id).addEventListener('input', onWork);
    $(id).addEventListener('change', onWork);
  }

  // ---- 3. display --------------------------------------------------------------
  $('showWork').addEventListener('change', (e) => save((s) => { s.display.showWork = e.target.checked; }));
  for (const r of document.querySelectorAll('input[name="rounding"]')) {
    r.addEventListener('change', () => save((s) => { s.display.rounding = r.value; }));
  }
  for (const r of document.querySelectorAll('input[name="style"]')) {
    r.addEventListener('change', () => save((s) => { s.display.style = r.value; }));
  }

  function renderDisplay() {
    const d = settings.display;
    $('showWork').checked = d.showWork;
    for (const r of document.querySelectorAll('input[name="rounding"]')) r.checked = r.value === d.rounding;
    for (const r of document.querySelectorAll('input[name="style"]')) r.checked = r.value === d.style;
    const home = settings.homeCurrency;
    const v = CV.convert(49.99, 'USD', home, table());
    const hourly = CV.hourlyRate(settings.income, home, table());
    const b = $('sampleBadge');
    b.className = 'pill ' + (d.style === 'bold' ? 'bold' : 'subtle');
    b.textContent = v == null ? '(rates loading…)' : CV.badgeText({
      home: v, homeCurrency: home, hours: CV.hoursNeeded(v, hourly), income: settings.income, display: d,
    });
  }

  // ---- 4. mascot -----------------------------------------------------------------
  const gridCats = [];
  const customUrl = (mascot) => (customs.find((c) => 'custom:' + c.id === mascot) || {}).url || null;

  function catCard(id, title, blurb, url) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cat-card';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(settings.mascot === id));
    const box = document.createElement('div');
    box.className = 'cat-box';
    const el = cats.create(document, id, previewState, url);
    box.appendChild(el);
    gridCats.push(el);
    const name = document.createElement('b');
    name.textContent = title;
    const text = document.createElement('span');
    text.textContent = blurb;
    card.append(box, name, text);
    card.addEventListener('click', () => selectMascot(id));
    return card;
  }

  function renderGrid() {
    const root = $('catGrid');
    root.textContent = '';
    gridCats.length = 0;
    const groups = [
      ['Classic cats', cats.LIST.filter((c) => c.group === 'classic')],
      ['Meme cats', cats.LIST.filter((c) => c.group === 'meme')],
    ];
    for (const [title, list] of groups) {
      const h = document.createElement('h3');
      h.textContent = title;
      const grid = document.createElement('div');
      grid.className = 'cat-grid';
      for (const c of list) grid.appendChild(catCard(c.id, c.name, c.blurb));
      root.append(h, grid);
    }
    if (customs.length) {
      const h = document.createElement('h3');
      h.textContent = 'Your cats';
      const grid = document.createElement('div');
      grid.className = 'cat-grid';
      for (const c of customs) {
        const cell = document.createElement('div');
        cell.className = 'cat-cell';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'cat-remove';
        del.textContent = '×';
        del.title = 'Remove this image';
        del.setAttribute('aria-label', `Remove ${c.name}`);
        del.addEventListener('click', () => removeCustom(c.id));
        cell.append(catCard('custom:' + c.id, c.name, 'Uploaded by you.', c.url), del);
        grid.appendChild(cell);
      }
      root.append(h, grid);
    }
  }

  async function selectMascot(id) {
    await save((s) => { s.mascot = id; });
    cats.fill(heroCat, id, customUrl(id));
    cats.setState(heroCat, 'happy');
    setTimeout(() => cats.setState(heroCat, 'idle'), 1500);
    ui.updateToolbarIcon(id, customUrl(id));
  }

  for (const b of document.querySelectorAll('.state-bar button')) {
    b.addEventListener('click', () => {
      previewState = b.dataset.state;
      for (const x of document.querySelectorAll('.state-bar button')) x.classList.toggle('on', x === b);
      for (const el of gridCats) cats.setState(el, previewState);
    });
  }

  function renderUpload() {
    const full = customs.length >= MAX_CUSTOM;
    $('uploadCount').textContent = `${customs.length} of ${MAX_CUSTOM} used.`;
    $('uploadBtn').hidden = full;
    $('dropZone').textContent = full ? 'Remove one to add another' : 'Drop images here';
  }

  function uploadMsg(text, kind) {
    $('uploadMsg').textContent = text;
    $('uploadMsg').className = 'small ' + (kind || '');
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  async function addCustom(file) {
    if (customs.length >= MAX_CUSTOM) throw new Error(`You can keep up to ${MAX_CUSTOM} images. Remove one first.`);
    if (!UPLOAD_TYPES.includes(file.type)) throw new Error(`${file.name}: please use a PNG, JPG, GIF or WebP image.`);
    if (file.size > MAX_UPLOAD) throw new Error(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB; the limit is 1 MB.`);
    const url = await readAsDataUrl(file);
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => { throw new Error(`Couldn't read ${file.name}. Try another file.`); });
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'My cat';
    const index = [...customs.map(({ id: i, name: n }) => ({ id: i, name: n })), { id, name }];
    try {
      await chrome.storage.local.set({ ['customCat:' + id]: url, customCatIndex: index });
    } catch (e) {
      throw new Error('Not enough extension storage left. Remove an image and try again.');
    }
    customs.push({ id, name, url });
    return id;
  }

  async function handleFiles(files) {
    let lastId = null;
    const errors = [];
    for (const file of files) {
      try { lastId = await addCustom(file); } catch (e) { errors.push(e.message); }
    }
    if (lastId) {
      await selectMascot('custom:' + lastId);
      uploadMsg(errors.length ? errors.join(' ') : 'Looking good! Your upload is now the mascot.', errors.length ? 'err' : 'ok');
    } else if (errors.length) {
      uploadMsg(errors.join(' '), 'err');
    }
    renderGrid();
    renderUpload();
  }

  async function removeCustom(id) {
    customs = customs.filter((c) => c.id !== id);
    await chrome.storage.local.set({ customCatIndex: customs.map(({ id: i, name }) => ({ id: i, name })) });
    await chrome.storage.local.remove('customCat:' + id);
    uploadMsg('Image removed.', 'ok');
    if (settings.mascot === 'custom:' + id) await selectMascot('loaf');
    else renderAll();
  }

  $('upload').addEventListener('change', (e) => { handleFiles([...e.target.files]); e.target.value = ''; });
  const drop = $('dropZone');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    handleFiles([...e.dataTransfer.files]);
  });

  // ---- 5. price moods -------------------------------------------------------------
  for (const r of document.querySelectorAll('input[name="moodMode"]')) {
    r.addEventListener('change', () => save((s) => { s.moodMode = r.value; }));
  }

  function catSelect(value, onChange) {
    const sel = document.createElement('select');
    const group = (label, items) => {
      if (!items.length) return;
      const g = document.createElement('optgroup');
      g.label = label;
      for (const [id, name] of items) {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = name;
        g.appendChild(o);
      }
      sel.appendChild(g);
    };
    group('Classic cats', cats.LIST.filter((c) => c.group === 'classic').map((c) => [c.id, c.name]));
    group('Meme cats', cats.LIST.filter((c) => c.group === 'meme').map((c) => [c.id, c.name]));
    group('Your cats', customs.map((c) => ['custom:' + c.id, c.name]));
    sel.value = value;
    if (sel.value !== value) sel.value = 'loaf'; // e.g. a removed upload
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  function renderMoods() {
    for (const r of document.querySelectorAll('input[name="moodMode"]')) r.checked = r.value === settings.moodMode;
    const ul = $('moodList');
    ul.textContent = '';
    for (const m of CV.moodRanges(settings.income, settings.homeCurrency, table())) {
      const li = document.createElement('li');
      li.classList.toggle('empty', m.empty);
      const catId = CL.settings.catForMood(settings, m.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mood-cat';
      btn.title = 'Click for another line';
      btn.appendChild(cats.create(document, catId, m.expr, customUrl(catId)));
      const info = document.createElement('div');
      info.className = 'mood-info';
      const pill = document.createElement('span');
      pill.className = 'mood-pill';
      pill.dataset.mood = m.id;
      pill.textContent = m.label;
      const range = document.createElement('div');
      range.className = 'mood-range';
      range.textContent = m.empty ? 'Skipped with your current work settings' : m.range;
      const say = document.createElement('div');
      say.className = 'mood-say';
      say.textContent = `“${CV.moodPhrase(m)}”`;
      btn.addEventListener('click', () => { say.textContent = `“${CV.moodPhrase(m)}”`; });
      info.append(pill, range, say);
      const sel = catSelect(settings.moodCats[m.id], (v) => save((s) => { s.moodCats[m.id] = v; }));
      sel.disabled = settings.moodMode !== 'squad';
      sel.setAttribute('aria-label', `Cat for “${m.label}”`);
      li.append(btn, info, sel);
      ul.appendChild(li);
    }
  }

  // ---- 6. disabled sites -------------------------------------------------------------
  function renderSites() {
    const ul = $('sites');
    ul.textContent = '';
    if (!settings.disabledSites.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No disabled sites.';
      ul.appendChild(li);
      return;
    }
    for (const host of [...settings.disabledSites].sort()) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = host;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Remove';
      btn.setAttribute('aria-label', `Re-enable Callina on ${host}`);
      btn.addEventListener('click', () => save((s) => { s.disabledSites = s.disabledSites.filter((h) => h !== host); }));
      li.append(name, btn);
      ul.appendChild(li);
    }
  }

  function renderRateLine() {
    const r = rateInfo && rateInfo.rates;
    $('rateLine').textContent = r
      ? `Exchange rates from ${r.source}, dated ${r.date} (fetched ${ui.timeAgo(r.fetchedAt)}).`
      : 'Exchange rates not loaded yet.';
  }

  function renderAll() {
    renderHome();
    renderWorkPreview();
    renderDisplay();
    renderGrid();
    renderUpload();
    renderMoods();
    renderSites();
    renderRateLine();
  }

  // Keep in sync with changes made from the popup.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      const prevIncome = JSON.stringify(settings.income);
      settings = CL.settings.normalizeSettings(changes.settings.newValue);
      if (JSON.stringify(settings.income) !== prevIncome && !document.activeElement.closest('.sentence')) fillWork();
      renderAll();
    }
    if (area === 'local' && changes.rates && changes.rates.newValue) {
      rateInfo = { ...(rateInfo || {}), rates: changes.rates.newValue };
      choices = ui.currencyChoices(table());
      renderAll();
    }
  });

  fillWork();
  renderAll();
  ui.updateToolbarIcon(settings.mascot, customUrl(settings.mascot));
})();
