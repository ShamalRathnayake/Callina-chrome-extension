// Price detection + parsing. Pure: no DOM, no chrome.* (unit-tested with node:test).
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});
  if (!CL.MARKERS && typeof require === 'function') require('../shared/currencies.js');
  const { MARKERS, AMBIGUOUS, TLD_CURRENCY, CURRENCIES } = CL;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const LATIN = /\p{Script=Latin}/u;

  // Latin-letter markers ("Rs", "kr", "USD") must not be glued to other letters.
  function markerPattern(m) {
    let p = esc(m);
    if (LATIN.test(m[0])) p = '(?<!\\p{L})' + p;
    if (LATIN.test(m[m.length - 1])) p += '(?!\\p{L})';
    return p;
  }
  const MARK = '(' + Object.keys(MARKERS).sort((a, b) => b.length - a.length).map(markerPattern).join('|') + ')';

  // Thousands separators: comma, dot, (narrow) no-break space, thin space, space, apostrophe.
  const SEP = "[,.\\u00A0\\u202F\\u2009 ']";
  const NUM = `(\\d{1,3}(?:${SEP}\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)`;
  const MAG = '(?:(k|K|m|M|bn|B)(?!\\p{L})|[ \\u00A0](thousand|million|billion|mn|bn)(?!\\p{L}))?';
  const GUARD = '(?![.,]?\\d)(?!\\s?%)';
  const GAP = '[ \\u00A0\\u202F]?';

  // Alternative 1: marker then number ("$49.99", "USD 49", "EUR49").
  // Alternative 2: number then marker ("49 USD", "1.299,00 €", "3000円").
  //   The marker must not be immediately followed by a digit, so "20 $50" reads as "$50".
  const PRICE_RE = new RegExp(
    `${MARK}${GAP}${NUM}${MAG}${GUARD}` +
      `|(?<![\\p{L}\\p{N}.,:/])${NUM}${MAG}${GUARD}${GAP}${MARK}(?!\\d)`,
    'gu'
  );
  // "$10–20" / "$10 to 20": a bare number right after a prefixed price.
  const RANGE_AFTER = new RegExp(`^(?:\\s?[-–—~]\\s?|\\s+to\\s+)${NUM}${MAG}${GUARD}(?!${GAP}${MARK})`, 'u');
  // "10–20 €": a bare number right before a suffixed price.
  const RANGE_BEFORE = new RegExp(`(?<![\\p{L}\\p{N}.,:/])${NUM}${MAG}(?:\\s?[-–—~]\\s?|\\s+to\\s+)$`, 'u');

  const MAGNITUDE = { k: 1e3, K: 1e3, thousand: 1e3, m: 1e6, M: 1e6, million: 1e6, mn: 1e6, bn: 1e9, B: 1e9, billion: 1e9 };

  // §5.2 number-format disambiguation.
  function parseNumber(str) {
    let s = String(str).replace(/[    ']/g, '');
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      // The last separator is the decimal one.
      const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
      const thou = dec === '.' ? ',' : '.';
      s = s.split(thou).join('').replace(dec, '.');
    } else if (hasDot || hasComma) {
      const sep = hasDot ? '.' : ',';
      const parts = s.split(sep);
      if (parts.length > 2) {
        s = parts.join(''); // "1.234.567" → thousands
      } else {
        const [int, frac] = parts;
        // exactly 3 digits after → thousands ("1,234"), except "0.500"-style amounts
        if (frac.length === 3 && int !== '0') s = int + frac;
        else s = int + '.' + frac;
      }
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // "shop.example.com.au" → "com.au"; "amazon.co.jp" → "co.jp"; "x.ca" → "ca".
  function tldOf(hostname) {
    const parts = String(hostname || '').toLowerCase().split('.').filter(Boolean);
    if (parts.length >= 2) {
      const two = parts.slice(-2).join('.');
      if (TLD_CURRENCY[two]) return two;
    }
    return parts.length ? parts[parts.length - 1] : '';
  }

  // §5.3 resolution order for a marker. Returns { currency, ambiguous, via }.
  function resolveCurrency(marker, ctx = {}) {
    const info = MARKERS[marker];
    if (!info) return null;
    if (info.currency) return { currency: info.currency, ambiguous: null, via: 'explicit' };
    const group = AMBIGUOUS[info.group];
    const ok = (c) => c && group.candidates.includes(c);
    if (ok(ctx.pageCurrency)) return { currency: ctx.pageCurrency, ambiguous: info.group, via: 'page' };
    if (info.group === 'DOLLAR' && ctx.dollarOverride && CURRENCIES[ctx.dollarOverride]) {
      return { currency: ctx.dollarOverride, ambiguous: info.group, via: 'override' };
    }
    const tldCur = TLD_CURRENCY[ctx.tld];
    if (ok(tldCur)) return { currency: tldCur, ambiguous: info.group, via: 'tld' };
    return { currency: group.fallback(ctx.homeCurrency), ambiguous: info.group, via: 'default' };
  }

  function amountOf(num, mag) {
    const n = parseNumber(num);
    return mag ? n * MAGNITUDE[mag] : n;
  }

  // Find every price in a string. Includes prices already in the home currency
  // (flagged isHome) so callers can still tell a "$" was seen.
  function findPrices(text, ctx = {}) {
    const out = [];
    if (!text || !/\d/.test(text)) return out;
    PRICE_RE.lastIndex = 0;
    let m;
    while ((m = PRICE_RE.exec(text))) {
      const prefix = m[1] !== undefined;
      const marker = prefix ? m[1] : m[8];
      const num = prefix ? m[2] : m[5];
      const mag = prefix ? m[3] || m[4] : m[6] || m[7];
      let amount = amountOf(num, mag);
      let start = m.index;
      let end = m.index + m[0].length;
      let amountHigh;

      const res = resolveCurrency(marker, ctx);
      if (!res || !Number.isFinite(amount) || amount <= 0 || amount > 1e12) continue;
      // "PHP 8.2" is a programming language far more often than pesos.
      if (marker === 'PHP' && amount < 10) continue;

      if (prefix) {
        const r = RANGE_AFTER.exec(text.slice(end));
        if (r) {
          const hi = amountOf(r[1], r[2] || r[3]);
          if (hi > amount) { amountHigh = hi; end += r[0].length; PRICE_RE.lastIndex = end; }
        }
      } else {
        const before = text.slice(Math.max(0, start - 40), start);
        const r = RANGE_BEFORE.exec(before);
        const prevEnd = out.length ? out[out.length - 1].end : 0;
        if (r) {
          const lo = amountOf(r[1], r[2] || r[3]);
          const newStart = start - r[0].length;
          if (lo < amount && newStart >= prevEnd) { amountHigh = amount; amount = lo; start = newStart; }
        }
      }

      out.push({
        start, end, raw: text.slice(start, end), marker, amount,
        ...(amountHigh !== undefined ? { amountHigh } : {}),
        currency: res.currency, ambiguous: res.ambiguous, via: res.via,
        isHome: !!ctx.homeCurrency && res.currency === ctx.homeCurrency,
      });
    }
    return out;
  }

  // The whole (trimmed) string is exactly one price → that price, else null. Used for split prices.
  function exactPrice(text, ctx) {
    const t = String(text).replace(/\s+/g, ' ').trim();
    if (!t || t.length > 40) return null;
    const found = findPrices(t, ctx);
    return found.length === 1 && found[0].start === 0 && found[0].end === t.length ? found[0] : null;
  }

  // Walk parsed JSON-LD for offers.priceCurrency (handles @graph, arrays, nesting).
  function currencyFromJsonLd(data, depth = 0) {
    if (!data || typeof data !== 'object' || depth > 8) return null;
    if (Array.isArray(data)) {
      for (const d of data) { const c = currencyFromJsonLd(d, depth + 1); if (c) return c; }
      return null;
    }
    if (typeof data.priceCurrency === 'string' && /^[A-Za-z]{3}$/.test(data.priceCurrency.trim())) {
      return data.priceCurrency.trim().toUpperCase();
    }
    for (const key of ['offers', '@graph', 'priceSpecification', 'mainEntity', 'itemListElement', 'item']) {
      const c = currencyFromJsonLd(data[key], depth + 1);
      if (c) return c;
    }
    return null;
  }

  CL.parser = { parseNumber, tldOf, resolveCurrency, findPrices, exactPrice, currencyFromJsonLd };
  if (typeof module !== 'undefined' && module.exports) module.exports = CL.parser;
})(globalThis);
