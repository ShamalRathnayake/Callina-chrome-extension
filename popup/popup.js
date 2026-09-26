'use strict';
(async function () {
  const CL = globalThis.Callina;
  const { ui, cats, convert: CV } = CL;
  const $ = (id) => document.getElementById(id);

  ui.injectCatCss();
  let settings = await ui.loadSettings();
  let customCat = await ui.loadCustomUrl(settings.mascot);
  let rateInfo = null; // { rates, status }
  let pageInfo = null;
  let tabId = null;

  // ---- mascot ---------------------------------------------------------------
  const cat = cats.create(document, settings.mascot, 'idle', customCat);
  $('cat').appendChild(cat);
  let reactTimer = null;
  function react(state, ms = 1800) {
    cats.setState(cat, state);
    clearTimeout(reactTimer);
    reactTimer = setTimeout(() => cats.setState(cat, 'idle'), ms);
  }
  ui.updateToolbarIcon(settings.mascot, customCat);

  // ---- page info from the content script ------------------------------------
  async function queryPage() {
    if (tabId == null) return null;
    try {
      return await chrome.tabs.sendMessage(tabId, { type: 'getPageInfo' });
    } catch (_) {
      return null; // chrome:// pages, the Web Store, PDFs, or a tab opened before install
    }
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab ? tab.id : null;
  } catch (_) { /* no active tab */ }

  // Saves, or shows why it couldn't; either way `settings` ends up matching storage.
  async function save(mutator) {
    try {
      settings = await ui.saveSettings(mutator);
      $('err').hidden = true;
    } catch (e) {
      settings = await ui.loadSettings();
      $('err').textContent = e.message;
      $('err').hidden = false;
    }
    render();
  }

  // ---- render ---------------------------------------------------------------
  function render() {
    ui.applyTheme(settings.theme);
    const home = settings.homeCurrency;
    $('tagline').textContent = settings.enabled ? `Showing prices in ${home}` : 'Taking a nap (off)';
    $('enabled').checked = settings.enabled;

    if (pageInfo) {
      const host = pageInfo.hostname;
      $('siteRow').hidden = !host; // e.g. file:// pages have no site to switch off
      $('host').textContent = host;
      $('siteDisabled').checked = settings.disabledSites.includes(host);

      const override = settings.dollarOverrides[host] || '';
      const showDollar = !!host && (pageInfo.hasDollar || !!override);
      $('dollarRow').hidden = !showDollar;
      const sel = $('dollar');
      if (showDollar && sel.dataset.auto !== pageInfo.dollarAuto) {
        sel.dataset.auto = pageInfo.dollarAuto;
        sel.textContent = '';
        const auto = document.createElement('option');
        auto.value = '';
        auto.textContent = `Auto (${pageInfo.dollarAuto})`;
        sel.appendChild(auto);
        for (const code of CL.AMBIGUOUS.DOLLAR.candidates) {
          const o = document.createElement('option');
          o.value = code;
          o.textContent = `${code} — ${CL.CURRENCIES[code].name}`;
          sel.appendChild(o);
        }
      }
      if (showDollar && document.activeElement !== sel) sel.value = override;

      const siteOff = settings.disabledSites.includes(host);
      $('count').textContent = !settings.enabled ? 'Callina is off.'
        : siteOff ? 'Disabled on this site.'
        : pageInfo.count === 1 ? 'Converted 1 price on this page'
        : `Converted ${pageInfo.count} prices on this page`;
    } else {
      $('siteRow').hidden = true;
      $('dollarRow').hidden = true;
      $('count').textContent = "Can't run on this page.";
    }
    renderRates();
    renderWork();
  }

  function renderRates() {
    const el = $('rates');
    const src = rateInfo && rateInfo.rates && rateInfo.rates.source;
    $('attrib').hidden = src !== 'open.er-api.com';
    if (src === 'open.er-api.com' && !$('attrib').firstChild) $('attrib').appendChild(ui.erApiAttribution());
    if (!rateInfo || !rateInfo.rates) {
      el.textContent = rateInfo && rateInfo.status && !rateInfo.status.ok ? 'Rates unavailable (offline?)' : 'Loading rates…';
      el.title = rateInfo && rateInfo.status ? rateInfo.status.error || '' : '';
      return;
    }
    const r = rateInfo.rates;
    const failed = rateInfo.status && rateInfo.status.ok === false;
    el.textContent = failed ? `Offline · rates from ${r.date}` : `Rates updated ${ui.timeAgo(r.fetchedAt)}`;
    el.title = `Source: ${r.source}\nRate date: ${r.date}${failed ? `\nLast error: ${rateInfo.status.error}` : ''}`;
  }

  function incomeFromInputs() {
    const num = (id) => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
    return {
      amount: num('incAmount'),
      currency: $('incCurrency').value || settings.homeCurrency,
      hoursPerDay: num('incHours'),
      daysPerMonth: num('incDays'),
    };
  }

  function renderWork() {
    const inc = settings.income;
    $('incomeNotice').hidden = CV.validIncome(inc);
    const table = rateInfo && rateInfo.rates && rateInfo.rates.table;
    const hourly = CV.hourlyRate(inc, settings.homeCurrency, table);
    $('workSummary').textContent = hourly ? `· ${CV.formatMoney(hourly, settings.homeCurrency)}/h` : '· not set';
    $('workPreview').textContent = hourly
      ? `Your time is worth ≈ ${CV.formatMoney(hourly, settings.homeCurrency)} / hour`
      : CV.validIncome(inc) ? 'Waiting for exchange rates…' : 'Fill in all three fields to see prices in hours of work.';
  }

  function fillWorkInputs() {
    const inc = settings.income;
    $('incAmount').value = inc.amount ?? '';
    $('incHours').value = inc.hoursPerDay ?? '';
    $('incDays').value = inc.daysPerMonth ?? '';
    ui.fillCurrencySelect($('incCurrency'), ui.currencyChoices(rateInfo && rateInfo.rates && rateInfo.rates.table), inc.currency);
  }

  // ---- events ---------------------------------------------------------------
  $('enabled').addEventListener('change', async (e) => {
    const on = e.target.checked;
    react(on ? 'happy' : 'faint', on ? 1800 : 2600);
    await save((s) => { s.enabled = on; });
  });

  $('siteDisabled').addEventListener('change', async (e) => {
    const host = pageInfo && pageInfo.hostname;
    if (!host) return;
    const off = e.target.checked;
    react(off ? 'shocked' : 'happy');
    await save((s) => {
      s.disabledSites = s.disabledSites.filter((h) => h !== host);
      if (off) s.disabledSites.push(host);
    });
  });

  $('dollar').addEventListener('change', async (e) => {
    const host = pageInfo && pageInfo.hostname;
    if (!host) return;
    const v = e.target.value;
    await save((s) => {
      if (v) s.dollarOverrides[host] = v;
      else delete s.dollarOverrides[host];
    });
    react('happy', 1200);
  });

  $('setIncome').addEventListener('click', (e) => {
    e.preventDefault();
    $('work').open = true;
    $('incAmount').focus();
  });

  let workTimer = null;
  function onWorkInput() {
    clearTimeout(workTimer);
    workTimer = setTimeout(async () => {
      const inc = incomeFromInputs();
      await save((s) => { s.income = inc; });
    }, 400);
  }
  for (const id of ['incAmount', 'incHours', 'incDays', 'incCurrency']) {
    $(id).addEventListener('input', onWorkInput);
    $(id).addEventListener('change', onWorkInput);
  }

  $('refresh').addEventListener('click', async () => {
    const btn = $('refresh');
    btn.classList.add('spin');
    btn.disabled = true;
    try {
      rateInfo = await chrome.runtime.sendMessage({ type: 'refreshRates' });
      react(rateInfo && rateInfo.status && rateInfo.status.ok ? 'happy' : 'shocked', 1400);
    } catch (_) {
      react('shocked', 1400); // worker unavailable; the rates line keeps the last known state
    } finally {
      btn.classList.remove('spin');
      btn.disabled = false;
      render();
    }
  });

  $('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      settings = CL.settings.normalizeSettings(changes.settings.newValue);
      if (cat.dataset.mascot !== settings.mascot) {
        ui.loadCustomUrl(settings.mascot).then((url) => { customCat = url; cats.fill(cat, settings.mascot, customCat); });
      }
      render();
    }
    if (area === 'local' && (changes.rates || changes.rateStatus)) {
      chrome.runtime.sendMessage({ type: 'getRates' }).then((r) => { rateInfo = r; render(); }, () => {});
    }
  });

  // ---- initial load -----------------------------------------------------------
  fillWorkInputs();
  render();
  [pageInfo, rateInfo] = await Promise.all([
    queryPage(),
    chrome.runtime.sendMessage({ type: 'getRates' }).catch(() => null),
  ]);
  fillWorkInputs();
  render();

  // The page is still being scanned in idle chunks, so keep the count fresh.
  setInterval(async () => {
    const info = await queryPage();
    if (info) { pageInfo = info; render(); }
  }, 1000);
})();
