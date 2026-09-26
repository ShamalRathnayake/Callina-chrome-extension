// Rate-table validation. Pure (no chrome.*): loaded by the service worker and the Node tests.
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});

  // Currencies watched for suspicious jumps; all sources carry these.
  const WATCH = ['eur', 'gbp', 'jpy', 'cny', 'inr', 'lkr', 'aud', 'cad', 'chf', 'sgd'];
  const MAX_JUMP = 0.25; // vs. the cached table: bigger moves need a second source to agree
  const MAX_DISAGREE = 0.05; // two sources "agree" when every watched rate is within 5 %

  // Keep only 3-letter codes with positive numeric rates, lower-cased.
  function cleanTable(raw) {
    const out = {};
    for (const [k, v] of Object.entries(raw || {})) {
      if (/^[a-z]{3}$/i.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) out[k.toLowerCase()] = v;
    }
    out.usd = 1;
    return out;
  }

  const cleanDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : 'unknown date');

  // Largest relative difference between two tables over the watched currencies both have.
  function maxDeviation(a, b) {
    let worst = 0;
    for (const k of WATCH) {
      if (a && b && a[k] && b[k]) worst = Math.max(worst, Math.abs(a[k] / b[k] - 1));
    }
    return worst;
  }

  // A fresh table is trusted when it's close to the cached one, or another source agrees with it.
  const plausible = (table, cached) => !!cached && maxDeviation(table, cached) <= MAX_JUMP;
  const agree = (a, b) => maxDeviation(a, b) <= MAX_DISAGREE;

  // Toolbar icons are small PNG data URLs rendered by our own pages; accept nothing else.
  const isIconUrl = (u) => typeof u === 'string' && u.length < 100000 && u.startsWith('data:image/png;base64,');

  CL.rates = { WATCH, MAX_JUMP, MAX_DISAGREE, cleanTable, cleanDate, maxDeviation, plausible, agree, isIconUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = CL.rates;
})(globalThis);
