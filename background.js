// Callina service worker: fetches + caches exchange rates, applies the toolbar icon.
'use strict';
importScripts('shared/rates.js');
const R = globalThis.Callina.rates;

const TTL = 12 * 60 * 60 * 1000; // refresh rates older than 12 h
const RETRY_AFTER_FAIL = 5 * 60 * 1000; // don't hammer the APIs while offline

// All sources are USD-based; any pair is cross-converted (see content/convert.js).
const fawaz = (d) => (d && d.usd && typeof d.date === 'string' ? { table: d.usd, date: d.date } : null);
const SOURCES = [
  { id: 'jsDelivr (fawazahmed0/exchange-api)', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json', parse: fawaz },
  { id: 'Cloudflare (fawazahmed0/exchange-api)', url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json', parse: fawaz },
  {
    id: 'open.er-api.com',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (d) => d && d.result === 'success' && d.rates
      ? { table: d.rates, date: new Date(d.time_last_update_unix * 1000).toISOString().slice(0, 10) }
      : null,
  },
];

async function fetchFrom(source) {
  const res = await fetch(source.url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = source.parse(await res.json());
  if (!parsed) throw new Error('unexpected response');
  const table = R.cleanTable(parsed.table);
  if (!table.lkr || Object.keys(table).length < 30) throw new Error('rate table incomplete');
  return { table, date: R.cleanDate(parsed.date), fetchedAt: Date.now(), source: source.id };
}

let inflight = null;

function refresh() {
  if (!inflight) {
    inflight = (async () => {
      const { rates: cached } = await chrome.storage.local.get('rates');
      const save = async (rates) => {
        const rateStatus = { ok: true, lastAttempt: Date.now() };
        await chrome.storage.local.set({ rates, rateStatus });
        return { rates, status: rateStatus };
      };
      // A table is accepted when it's close to the cached one, or when a second source agrees with it.
      // One compromised or broken source can't swing every price on its own.
      const errors = [];
      const unconfirmed = [];
      for (const source of SOURCES) {
        try {
          const rates = await fetchFrom(source);
          if (R.plausible(rates.table, cached && cached.table) || unconfirmed.some((o) => R.agree(o.table, rates.table))) {
            return save(rates);
          }
          unconfirmed.push(rates);
          errors.push(`${source.id}: ${cached ? 'rates moved more than 25 %' : 'first fetch'}, waiting for a second source to agree`);
        } catch (e) {
          errors.push(`${source.id}: ${e && e.message ? e.message : e}`);
        }
      }
      // Nothing cached to protect and only one source reachable: better than no rates at all.
      if (!cached && unconfirmed.length) return save(unconfirmed[0]);
      const rateStatus = { ok: false, lastAttempt: Date.now(), error: errors.join(' · ') };
      await chrome.storage.local.set({ rateStatus });
      return { rates: cached || null, status: rateStatus };
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

// Serve cached rates immediately; refresh lazily in the background when stale.
async function getRates(force) {
  const { rates, rateStatus } = await chrome.storage.local.get(['rates', 'rateStatus']);
  const recentlyFailed = rateStatus && !rateStatus.ok && Date.now() - rateStatus.lastAttempt < RETRY_AFTER_FAIL;
  if (force) return refresh();
  if (!rates) return recentlyFailed ? { rates: null, status: rateStatus } : refresh();
  const stale = Date.now() - rates.fetchedAt > TTL;
  if (stale && !recentlyFailed) refresh(); // storage.onChanged tells tabs about the new rates
  return { rates, status: rateStatus || { ok: true } };
}

// Only our own pages (popup/options) may force a refresh; content scripts just read.
const fromExtensionPage = (sender) => typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || sender.id !== chrome.runtime.id) return false;
  if (msg.type !== 'getRates' && !(msg.type === 'refreshRates' && fromExtensionPage(sender))) return false;
  getRates(msg.type === 'refreshRates').then(sendResponse, (e) =>
    sendResponse({ rates: null, status: { ok: false, error: String(e) } })
  );
  return true; // async response
});

// ---- Toolbar icon -------------------------------------------------------
// The popup/options pages render the selected cat to small PNGs (SVG can't be decoded
// in a worker) and store them as `icon`; here we decode them with OffscreenCanvas.
async function toImageData(dataUrl, size) {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

async function applyIcon() {
  try {
    const { icon } = await chrome.storage.local.get('icon');
    if (!icon || !R.isIconUrl(icon['16']) || !R.isIconUrl(icon['32'])) {
      await chrome.action.setIcon({ path: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } });
      return;
    }
    const imageData = { 16: await toImageData(icon['16'], 16), 32: await toImageData(icon['32'], 32) };
    await chrome.action.setIcon({ imageData });
  } catch (e) {
    console.warn('Callina: could not set toolbar icon', e);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.icon) applyIcon();
});

// Older builds kept a single upload under `customCat` with mascot "custom";
// move it to the multi-upload layout ("customCat:<id>" + customCatIndex).
async function migrateCustomCat() {
  const { customCat, customCatIndex = [] } = await chrome.storage.local.get(['customCat', 'customCatIndex']);
  if (!customCat) return;
  const id = 'c' + Date.now().toString(36);
  await chrome.storage.local.set({ ['customCat:' + id]: customCat, customCatIndex: [...customCatIndex, { id, name: 'My cat' }] });
  await chrome.storage.local.remove('customCat');
  const { settings } = await chrome.storage.sync.get('settings');
  if (settings && settings.mascot === 'custom') await chrome.storage.sync.set({ settings: { ...settings, mascot: 'custom:' + id } });
}

chrome.runtime.onStartup.addListener(() => { getRates(false); });
chrome.runtime.onInstalled.addListener(() => { migrateCustomCat().finally(applyIcon); refresh(); });
// setIcon doesn't survive the extension being disabled and re-enabled (neither event above
// fires then), so re-apply it whenever the worker starts.
applyIcon();
