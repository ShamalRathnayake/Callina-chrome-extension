// End-to-end checks against the real extension in Chrome for Testing (branded Chrome ignores --load-extension).
// Not part of `npm test`. Setup, once:
//   npx @puppeteer/browsers install chrome@stable --path /tmp/cft
//   npm i --no-save puppeteer-core
// Run:
//   node tests/e2e.js "/tmp/cft/chrome/<version>/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
'use strict';
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EXT = path.resolve(__dirname, '..');
const CHROME = process.argv[2];
if (!CHROME) { console.error('usage: node tests/e2e.js <path to Chrome for Testing>'); process.exit(2); }

const PAGES = {
  '/prices.html': () => fs.readFileSync(path.join(__dirname, 'fixtures/prices.html')),
  // 19 KB (scanned) and 200 KB (skipped) runs of grouped digits; used to freeze the tab for ~20 s.
  '/big.html': () => `<p>${'123 '.repeat(4700)}</p><p>${'123 '.repeat(50000)}</p><p id="price">Price $10</p>`,
  // SPA navigation that changes the page's declared currency after load.
  '/spa.html': () => `<p id="p">Only $10</p><script>
    setTimeout(() => {
      history.pushState({}, '', '/spa2');
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify({ offers: { priceCurrency: 'CAD' } });
      document.head.appendChild(s);
      document.getElementById('p').firstChild.data = 'Only $10';
    }, 1500);</script>`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

// Same rule as the fixture page's own self-check.
const fixtureResult = (page) => page.$$eval('li[data-expect]', (lis) => {
  const bad = lis.filter((li) => li.querySelectorAll('callina-badge:not([hidden])').length !== +li.dataset.expect);
  return { total: lis.length, failed: bad.map((li) => li.textContent.slice(0, 50)) };
});
const badgesIn = (page, text) => page.$$eval('li', (lis, t) => {
  const li = lis.find((x) => x.textContent.includes(t));
  return li ? li.querySelectorAll('callina-badge').length : -1;
}, text);

// Text rendered inside the closed shadow roots of badges (CDP can pierce them; pages can't).
async function badgeTexts(page) {
  const cdp = await page.createCDPSession();
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const out = [];
  const text = (n) => (n.nodeType === 3 ? n.nodeValue : [...(n.children || []), ...(n.shadowRoots || [])].map(text).join(''));
  (function walk(n) {
    if (n.nodeName === 'CALLINA-BADGE') { out.push(text(n)); return; }
    for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) walk(c);
  })(root);
  await cdp.detach();
  return out;
}

(async () => {
  const srv = http.createServer((q, r) => {
    const page = PAGES[new URL(q.url, 'http://x').pathname] || PAGES['/spa.html'];
    r.setHeader('content-type', 'text/html; charset=utf-8');
    r.end(page());
  }).listen(8767);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, enableExtensions: [EXT] });
  const errors = [];
  try {
    const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 10000 });
    const sw = await swTarget.worker();
    const setSettings = (patch) => sw.evaluate(async (p) => {
      const { settings = {} } = await chrome.storage.sync.get('settings');
      await chrome.storage.sync.set({ settings: { ...settings, ...p } });
    }, patch);
    await sleep(3000); // first rate fetch

    // 1. Fixtures, then split prices must survive a rescan (home currency round trip).
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push('page: ' + e.message));
    await page.goto('http://localhost:8767/prices.html');
    await sleep(3000);
    let r = await fixtureResult(page);
    check('fixtures', r.failed.length === 0, `${r.total - r.failed.length}/${r.total}${r.failed.length ? ' failed: ' + r.failed.join(' | ') : ''}`);
    await setSettings({ homeCurrency: 'USD' });
    await sleep(1500);
    await setSettings({ homeCurrency: 'LKR' });
    await sleep(2500);
    check('split price after home-currency change', (await badgesIn(page, 'Split with sup cents')) === 1);
    check('Amazon split price after home-currency change', (await badgesIn(page, 'Amazon style')) === 1);
    r = await fixtureResult(page);
    check('fixtures after rescan', r.failed.length === 0, r.failed.join(' | '));

    // 2. Disabling removes every badge and rejoins the text nodes we split.
    await setSettings({ enabled: false });
    await sleep(1000);
    check('disabled: no badges', (await page.$$eval('callina-badge', (b) => b.length)) === 0);
    const textNodes = await page.$$eval('li', (lis) => {
      const li = lis.find((x) => x.textContent.includes('Two in one sentence'));
      return [...li.childNodes].filter((n) => n.nodeType === 3).length;
    });
    check('disabled: split text rejoined', textNodes === 1, `${textNodes} text nodes`);
    await setSettings({ enabled: true });
    await sleep(2500);
    r = await fixtureResult(page);
    check('re-enabled: fixtures', r.failed.length === 0, r.failed.join(' | '));

    // 3. Synthetic events from the page don't open the tooltip; real hover does.
    await page.evaluate(() => {
      const b = document.querySelector('callina-badge:not([hidden])');
      b.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      b.dispatchEvent(new MouseEvent('mouseenter'));
      b.dispatchEvent(new FocusEvent('focus'));
    });
    await sleep(300);
    const tipShown = () => page.evaluate(() => {
      const t = document.querySelector('callina-tip');
      return !!t && getComputedStyle(t).display !== 'none';
    });
    check('synthetic events ignored', !(await tipShown()));
    await page.hover('callina-badge:not([hidden])');
    await sleep(300);
    check('real hover shows tooltip', await tipShown());
    check('badges carry no data attributes', await page.$$eval('callina-badge', (bs) => bs.every((b) => Object.keys(b.dataset).length === 1)));

    // 4. Long digit runs don't freeze the page.
    const big = await browser.newPage();
    await big.goto('http://localhost:8767/big.html');
    let worst = 0;
    for (let i = 0; i < 15; i++) {
      const t = Date.now();
      await big.evaluate(() => 1);
      worst = Math.max(worst, Date.now() - t);
      await sleep(100);
    }
    check('no main-thread freeze on number dumps', worst < 300, `worst round trip ${worst} ms`);
    check('price next to the dump still converted', (await big.$$eval('#price callina-badge', (b) => b.length)) === 1);

    // 5. SPA navigation that declares a new currency re-reads "$".
    const spa = await browser.newPage();
    await spa.goto('http://localhost:8767/spa.html');
    await sleep(1000);
    const before = await badgeTexts(spa);
    await sleep(2500);
    const after = await badgeTexts(spa);
    check('SPA: "$" re-read after navigation', before.length === 1 && after.length === 1 && before[0] !== after[0], `${before} → ${after}`);
  } finally {
    await browser.close();
    srv.close();
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
