// Helpers shared by the popup and options pages (extension pages only; uses DOM + chrome.*).
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});
  const S = CL.settings;

  async function loadSettings() {
    const { settings } = await chrome.storage.sync.get('settings');
    return S.normalizeSettings(settings);
  }

  // Read-modify-write so the popup and options page don't clobber each other.
  async function saveSettings(mutator) {
    const current = await loadSettings();
    mutator(current);
    await chrome.storage.sync.set({ settings: current });
    return current;
  }

  // Data URL of the uploaded image for a "custom:<id>" mascot, else null.
  async function loadCustomUrl(mascot) {
    const key = CL.settings.customKey(mascot);
    if (!key) return null;
    const got = await chrome.storage.local.get(key);
    return got[key] || null;
  }

  // All uploaded mascots: [{ id, name, url }].
  async function loadCustomCats() {
    const { customCatIndex = [] } = await chrome.storage.local.get('customCatIndex');
    if (!customCatIndex.length) return [];
    const data = await chrome.storage.local.get(customCatIndex.map((c) => 'customCat:' + c.id));
    return customCatIndex.filter((c) => data['customCat:' + c.id]).map((c) => ({ ...c, url: data['customCat:' + c.id] }));
  }

  function injectCatCss() {
    if (document.getElementById('cc-css')) return;
    const style = document.createElement('style');
    style.id = 'cc-css';
    style.textContent = CL.cats.CSS;
    document.head.appendChild(style);
  }

  // Home/income currency choices: our table + every 3-letter code in the rate table
  // that the browser knows a name for.
  function currencyChoices(rateTable) {
    const names = new Map(Object.entries(CL.CURRENCIES).map(([code, c]) => [code, c.name]));
    let dn = null;
    try { dn = new Intl.DisplayNames(['en'], { type: 'currency' }); } catch (_) { /* old browser */ }
    if (dn && rateTable) {
      for (const k of Object.keys(rateTable)) {
        const code = k.toUpperCase();
        if (names.has(code)) continue;
        const name = dn.of(code);
        if (name && name !== code) names.set(code, name);
      }
    }
    return [...names.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, name]) => ({ code, name }));
  }

  function fillCurrencySelect(select, choices, selected) {
    select.textContent = '';
    for (const { code, name } of choices) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = `${code} — ${name}`;
      if (code === selected) o.selected = true;
      select.appendChild(o);
    }
  }

  function timeAgo(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 90) return 'just now';
    const m = s / 60;
    if (m < 60) return `${Math.round(m)} min ago`;
    const h = m / 60;
    if (h < 36) return `${Math.round(h)} h ago`;
    return `${Math.round(h / 24)} days ago`;
  }

  // ---- toolbar icon: render the selected cat to 16/32 px PNGs -------------------
  async function drawIcon(src, size) {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const w = img.naturalWidth || size;
    const h = img.naturalHeight || size;
    const scale = Math.min(size / w, size / h);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, (size - w * scale) / 2, (size - h * scale) / 2, w * scale, h * scale);
    return c.toDataURL('image/png');
  }

  async function updateToolbarIcon(mascot, customUrl) {
    try {
      const custom = CL.settings.customKey(mascot) && customUrl;
      const key = custom ? mascot : CL.cats.LIST.some((c) => c.id === mascot) ? mascot : 'loaf';
      const { icon } = await chrome.storage.local.get('icon');
      if (icon && icon.key === key) return;
      const src = custom
        ? customUrl
        : 'data:image/svg+xml;charset=utf-8,' +
          encodeURIComponent(CL.cats.iconSvg(mascot).replace('<svg ', '<svg width="128" height="128" '));
      const next = { key, 16: await drawIcon(src, 16), 32: await drawIcon(src, 32) };
      await chrome.storage.local.set({ icon: next });
    } catch (e) {
      console.warn('Callina: toolbar icon not updated', e);
    }
  }

  CL.ui = { loadSettings, saveSettings, loadCustomUrl, loadCustomCats, injectCatCss, currencyChoices, fillCurrencySelect, timeAgo, updateToolbarIcon };
})(globalThis);
