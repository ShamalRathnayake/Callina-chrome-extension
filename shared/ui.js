// Helpers shared by the popup and options pages (extension pages only; uses DOM + chrome.*).
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});
  const S = CL.settings;

  async function loadSettings() {
    const { settings } = await chrome.storage.sync.get('settings');
    return S.normalizeSettings(settings);
  }

  // Read-modify-write under a lock shared by the popup and options page (same origin),
  // so two quick saves from different pages can't clobber each other.
  // Throws an Error with a user-facing message when the save fails.
  async function saveSettings(mutator) {
    const run = async () => {
      const current = await loadSettings();
      mutator(current);
      // chrome.storage.sync caps one item at 8,192 bytes (key + JSON); the site lists are what grow.
      const size = new Blob(['settings' + JSON.stringify(current)]).size;
      if (size > chrome.storage.sync.QUOTA_BYTES_PER_ITEM) {
        throw new Error('Too many saved sites. Remove some disabled sites (Options → Disabled sites) and try again.');
      }
      try {
        await chrome.storage.sync.set({ settings: current });
      } catch (e) {
        throw new Error(`Couldn't save settings: ${e && e.message ? e.message : e}`);
      }
      return current;
    };
    return navigator.locks ? navigator.locks.request('callina-settings', run) : run();
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

  // ---- colour theme ---------------------------------------------------------------
  // The last theme is remembered in localStorage (this page's own origin) so it can be
  // applied before first paint, while the real value loads from chrome.storage.
  const THEME_KEY = 'callina-theme';
  function applyTheme(id) {
    let el = document.getElementById('cl-theme');
    if (!el) {
      el = document.createElement('style');
      el.id = 'cl-theme';
      document.head.appendChild(el);
    }
    el.textContent = CL.themes.themeCss(id);
    try { localStorage.setItem(THEME_KEY, id); } catch (_) { /* storage blocked */ }
  }
  let cachedTheme = null;
  try { cachedTheme = localStorage.getItem(THEME_KEY); } catch (_) { /* storage blocked */ }
  applyTheme(cachedTheme || CL.themes.DEFAULT_THEME);

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

  // ---- uploads: keep them small, since every tab that shows one has to load it ----------
  const MAX_SIDE = 256; // px; the largest place a cat is drawn is ~120 px
  const KEEP_GIF_BYTES = 300 * 1024; // small GIFs stay as they are, so they keep animating

  // Returns { url, note } — a data URL no bigger than needed, and a message if it had to lose its animation.
  async function shrinkImage(url, type) {
    const bytes = Math.floor((url.length - url.indexOf(',') - 1) * 0.75);
    if (type === 'image/gif' && bytes <= KEEP_GIF_BYTES) return { url, note: '' };
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || MAX_SIDE;
    const h = img.naturalHeight || MAX_SIDE;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/webp', 0.9);
    if (out.length >= url.length && type !== 'image/gif') return { url, note: '' };
    return { url: out, note: type === 'image/gif' ? 'Large GIFs are saved as a still image.' : '' };
  }

  // open.er-api.com's terms ask for this link wherever its rates are shown.
  function erApiAttribution() {
    const a = document.createElement('a');
    a.href = 'https://www.exchangerate-api.com';
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Rates By Exchange Rate API';
    return a;
  }

  CL.ui = { applyTheme, erApiAttribution, shrinkImage, loadSettings, saveSettings, loadCustomUrl, loadCustomCats, injectCatCss, currencyChoices, fillCurrencySelect, timeAgo, updateToolbarIcon };
})(globalThis);
