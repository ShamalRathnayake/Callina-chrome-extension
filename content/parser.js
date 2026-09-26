// Price detection + parsing. Pure: no DOM, no chrome.* (unit-tested with node:test).
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});
  if (!CL.MARKERS && typeof require === 'function') require('../shared/currencies.js');
  const { MARKERS, AMBIGUOUS, TLD_CURRENCY } = CL;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const LATIN = /\p{Script=Latin}/u;

  // Latin-letter markers ("Rs", "kr", "USD") must not be glued to other letters.
  function markerPattern(m) {
    let p = esc(m);
    if (LATIN.test(m[0])) p = '(?<!\\p{L})' + p;
    if (LATIN.test(m[m.length - 1])) p += '(?!\\p{L})';
    return p;
  }
  const MARK = '(?:' + Object.keys(MARKERS).sort((a, b) => b.length - a.length).map(markerPattern).join('|') + ')';

  // Thousands separators: comma, dot, (narrow) no-break space, thin space, space, apostrophe.
  // After a prefix marker a plain space is not a separator ("$10 250 sold" is $10, not $10,250).
  const SEP = "[,.\\u00A0\\u202F\\u2009 ']";
  const SEP_TIGHT = "[,.\\u00A0\\u202F\\u2009']";
  // A number. Named groups carry `tag` so one regex can hold several numbers.
  // Groups: every separator must match the first one, and the decimal mark must differ from it
  // ("1,234,5" is not a number). Lakh grouping: "1,00,000", "12,34,567.50".
  const num = (tag, sep) =>
    `(?<${tag}>\\d{1,3}(?<${tag}s>${sep})\\d{3}(?:\\k<${tag}s>\\d{3})*(?:(?!\\k<${tag}s>)[.,]\\d{1,2})?` +
    `|\\d{1,2}(?:,\\d{2})+,\\d{3}(?:\\.\\d{1,2})?` +
    `|\\d+(?:[.,]\\d{1,2})?)`;
  const mag = (tag) =>
    `(?:(?<${tag}k>k|K|m|M|bn|B)(?!\\p{L})|[ \\u00A0](?<${tag}w>thousand|million|billion|mn|bn)(?!\\p{L}))?`;
  const GUARD = '(?![.,]?\\d)(?!\\s?%)';
  const GAP = '[ \\u00A0\\u202F]?';
  const DASH = '(?:\\s?[-–—~]\\s?|\\s+to\\s+)';
  // A number may not start inside a digit-group chain ("123 [123] 123"). Without this, long runs
  // of grouped digits make the regex quadratic and can freeze the page.
  const NUM_START = `(?<![\\p{L}\\p{N}.,:/])(?<!\\d{3}${SEP})`;

  // Alternative 1: marker then number ("$49.99", "USD 49", "EUR49").
  // Alternative 2: number then marker ("49 USD", "1.299,00 €", "3000円").
  //   The marker must not be immediately followed by a digit, so "20 $50" reads as "$50".
  const PRICE_RE = new RegExp(
    `(?<pm>${MARK})${GAP}${num('pn', SEP_TIGHT)}${mag('p')}${GUARD}` +
      `|${NUM_START}${num('sn', SEP)}${mag('s')}${GUARD}${GAP}(?<sm>${MARK})(?!\\d)`,
    'gu'
  );
  // "$10–20" / "$10 to 20": a bare number right after a prefixed price (sticky: matched at lastIndex).
  const RANGE_AFTER = new RegExp(`${DASH}${num('rn', SEP_TIGHT)}${mag('r')}${GUARD}(?!${GAP}${MARK})`, 'uy');
  // "10–20 €": a bare number right before a suffixed price.
  const RANGE_BEFORE = new RegExp(`${NUM_START}${num('rn', SEP)}${mag('r')}${DASH}$`, 'u');
  // Longer text nodes are skipped: they are data dumps, not price tags, and cost too much to scan.
  const MAX_TEXT = 20000;

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
        // "1.234.567" → thousands; "1,00,000" → lakh grouping; anything else isn't a number.
        const rest = parts.slice(1);
        const last = rest[rest.length - 1];
        const thousands = rest.every((x) => x.length === 3);
        const lakh = sep === ',' && last.length === 3 && rest.slice(0, -1).every((x) => x.length === 2);
        if (!thousands && !lakh) return NaN;
        s = parts.join('');
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
      if (Object.hasOwn(TLD_CURRENCY, two)) return two;
    }
    return parts.length ? parts[parts.length - 1] : '';
  }

  // §5.3 resolution order for a marker. Returns { currency, ambiguous, via }.
  function resolveCurrency(marker, ctx = {}) {
    const info = Object.hasOwn(MARKERS, marker) ? MARKERS[marker] : null;
    if (!info) return null;
    if (info.currency) return { currency: info.currency, ambiguous: null, via: 'explicit' };
    const group = AMBIGUOUS[info.group];
    const ok = (c) => c && group.candidates.includes(c);
    if (ok(ctx.pageCurrency)) return { currency: ctx.pageCurrency, ambiguous: info.group, via: 'page' };
    if (info.group === 'DOLLAR' && ok(ctx.dollarOverride)) {
      return { currency: ctx.dollarOverride, ambiguous: info.group, via: 'override' };
    }
    const tldCur = Object.hasOwn(TLD_CURRENCY, ctx.tld || '') ? TLD_CURRENCY[ctx.tld] : null;
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
    if (!text || text.length > MAX_TEXT || !/\d/.test(text)) return out;
    PRICE_RE.lastIndex = 0;
    let m;
    while ((m = PRICE_RE.exec(text))) {
      const g = m.groups;
      const prefix = g.pm !== undefined;
      const marker = prefix ? g.pm : g.sm;
      const num = prefix ? g.pn : g.sn;
      const mag = prefix ? g.pk || g.pw : g.sk || g.sw;
      let amount = amountOf(num, mag);
      let start = m.index;
      let end = m.index + m[0].length;
      let amountHigh;

      const res = resolveCurrency(marker, ctx);
      if (!res || !Number.isFinite(amount) || amount <= 0 || amount > 1e12) continue;
      // "PHP 8.2" is a programming language far more often than pesos.
      if (marker === 'PHP' && amount < 10) continue;

      if (prefix) {
        RANGE_AFTER.lastIndex = end;
        const r = RANGE_AFTER.exec(text);
        if (r) {
          const hi = amountOf(r.groups.rn, r.groups.rk || r.groups.rw);
          if (hi > amount) { amountHigh = hi; end += r[0].length; PRICE_RE.lastIndex = end; }
        }
      } else {
        const before = text.slice(Math.max(0, start - 40), start);
        const r = RANGE_BEFORE.exec(before);
        const prevEnd = out.length ? out[out.length - 1].end : 0;
        if (r) {
          const lo = amountOf(r.groups.rn, r.groups.rk || r.groups.rw);
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
