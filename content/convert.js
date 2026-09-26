// Conversion, work-hours math and formatting. Pure: no DOM, no chrome.*.
// Rates table: USD-based, lower-case ISO keys ({ usd: 1, lkr: 330.0, eur: 0.85, ... }).
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});
  if (!CL.CURRENCIES && typeof require === 'function') require('../shared/currencies.js');
  const { CURRENCIES } = CL;

  function rateOf(table, code) {
    const v = table && code ? table[String(code).toLowerCase()] : undefined;
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  }

  // Cross rate through the USD base: 1 `from` = crossRate `to`.
  function crossRate(table, from, to) {
    if (from === to) return 1;
    const a = rateOf(table, from);
    const b = rateOf(table, to);
    return a && b ? b / a : null;
  }

  function convert(amount, from, to, table) {
    const r = crossRate(table, from, to);
    return r == null || !Number.isFinite(amount) ? null : amount * r;
  }

  const posNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

  // §6 validation: positive numbers, hours/day ≤ 24, days/month ≤ 31.
  function validIncome(inc) {
    return !!inc && posNum(inc.amount) && posNum(inc.hoursPerDay) && inc.hoursPerDay <= 24 &&
      posNum(inc.daysPerMonth) && inc.daysPerMonth <= 31 && typeof inc.currency === 'string';
  }

  // Home-currency earned per working hour, or null when income isn't usable.
  function hourlyRate(income, homeCurrency, table) {
    if (!validIncome(income)) return null;
    const monthlyHome = convert(income.amount, income.currency, homeCurrency, table);
    if (monthlyHome == null) return null;
    return monthlyHome / (income.hoursPerDay * income.daysPerMonth);
  }

  function hoursNeeded(priceHome, hourly) {
    return posNum(hourly) && Number.isFinite(priceHome) ? priceHome / hourly : null;
  }

  const oneDp = (n) => {
    const s = n.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };

  // Which unit a duration is shown in (§6 thresholds).
  function workUnit(hours, income) {
    const perDay = income.hoursPerDay;
    const perMonth = income.hoursPerDay * income.daysPerMonth;
    if (hours < 1 && Math.round(hours * 60) < 60) return { unit: 'min', value: Math.max(1, Math.round(hours * 60)) };
    if (hours < 1) return { unit: 'h', value: 1 };
    if (hours < perDay) return { unit: 'h', value: hours };
    if (hours < perMonth) return { unit: 'days', value: hours / perDay };
    return { unit: 'months', value: hours / perMonth };
  }

  // Badge text: "35 min", "2.4 h", "3.5 days", "1.2 months".
  function formatWorkShort(hours, income) {
    const { unit, value } = workUnit(hours, income);
    if (unit === 'min') return `${value} min`;
    if (unit === 'h') return `${oneDp(value)} h`;
    if (unit === 'days') return `${oneDp(value)} ${oneDp(value) === '1' ? 'day' : 'days'}`;
    return `${oneDp(value)} ${oneDp(value) === '1' ? 'month' : 'months'}`;
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // Tooltip text: "≈ 2 hours 24 minutes of work", "≈ 3.5 work days", "≈ 1.2 work months".
  function formatWorkLong(hours, income) {
    const { unit, value } = workUnit(hours, income);
    if (unit === 'min') return `≈ ${plural(value, 'minute')} of work`;
    if (unit === 'h') {
      let h = Math.floor(value);
      let min = Math.round((value - h) * 60);
      if (min === 60) { h += 1; min = 0; }
      return `≈ ${plural(h, 'hour')}${min ? ' ' + plural(min, 'minute') : ''} of work`;
    }
    if (unit === 'days') return `≈ ${oneDp(value)} work ${oneDp(value) === '1' ? 'day' : 'days'}`;
    return `≈ ${oneDp(value)} work ${oneDp(value) === '1' ? 'month' : 'months'}`;
  }

  function symbolFor(code) {
    const c = CURRENCIES[code];
    return c ? c.symbol : code;
  }

  function decimalsFor(code) {
    const c = CURRENCIES[code];
    return c ? c.decimals : 2;
  }

  function groupNumber(n, digits) {
    return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  // "Rs 15,200", "$12.40", "€3". Symbols made of letters get a space.
  function withSymbol(code, numText) {
    const sym = symbolFor(code);
    return /\p{L}$/u.test(sym) ? `${sym} ${numText}` : `${sym}${numText}`;
  }

  // rounding: 'whole' (0 decimals, but small amounts keep cents) | '2dp'.
  function digitsFor(amount, code, rounding) {
    const dec = decimalsFor(code);
    if (rounding === '2dp') return dec;
    return Math.abs(amount) < 10 && dec > 0 ? dec : 0;
  }

  function formatMoney(amount, code, rounding = 'whole') {
    return withSymbol(code, groupNumber(amount, digitsFor(amount, code, rounding)));
  }

  function formatMoneyRange(low, high, code, rounding = 'whole') {
    if (high == null) return formatMoney(low, code, rounding);
    const d = Math.max(digitsFor(low, code, rounding), digitsFor(high, code, rounding));
    return withSymbol(code, `${groupNumber(low, d)}–${groupNumber(high, d)}`);
  }

  // Tooltip "more precise" value: always 2 decimals.
  function formatPrecise(amount, code) {
    return withSymbol(code, groupNumber(amount, 2));
  }

  // "USD 49.99", "JPY 3,000", "USD 10–20".
  function formatOriginal(amount, code, high) {
    const d = (n) => (Number.isInteger(n) ? 0 : 2);
    const one = (n) => groupNumber(n, d(n));
    return high == null ? `${code} ${one(amount)}` : `${code} ${one(amount)}–${one(high)}`;
  }

  // "1 USD = 330.03 LKR"; small rates get significant digits instead.
  function formatRate(from, to, rate) {
    const r = rate >= 1 ? groupNumber(rate, 2) : Number(rate.toPrecision(4)).toString();
    return `1 ${from} = ${r} ${to}`;
  }

  // Six affordability moods, cheapest first. Each has a fixed facial expression; which cat
  // wears it is a user setting. Bounds are hours of work, or USD value when income isn't set.
  const MOODS = [
    { id: 'pocket', label: 'Pocket change', expr: 'love', usd: 5, phrases: [
      'Buy it. Buy two.', 'That’s basically free!', 'Cheaper than my treats.', 'Purr-fect price!',
      'Less than a nap’s worth.', 'I’d trade a sock for that.'] },
    { id: 'treat', label: 'Treat yourself', expr: 'happy', usd: 25, phrases: [
      'Go on, treat yourself.', 'Meow-velous deal!', 'You earned this one.', 'Tail says yes.',
      'A snack-sized splurge.', 'Worth a little purr.'] },
    { id: 'fair', label: 'Fair enough', expr: 'idle', usd: 100, phrases: [
      'Seems fair. I guess.', 'Not bad, human.', 'Paws-itively reasonable.', 'I’ve seen worse.',
      'Meh. Could be worse.', 'Acceptable. Carry on.'] },
    { id: 'pricey', label: 'Hmm, pricey', expr: 'worried', usd: 500, phrases: [
      'Do you *need* it though?', 'That’s a lot of kibble…', 'My whiskers are sweating.', 'Sleep on it. I will.',
      'Check for a sale first?', 'Hmm… that’s steep.'] },
    { id: 'ouch', label: 'Ouch', expr: 'shocked', usd: 2500, phrases: [
      'HOW MUCH?!', 'My wallet just meowed.', 'Put. It. Down.', 'Hiss. Absolutely hiss.',
      'My tail just fell off.', 'I need to lie down.'] },
    { id: 'nope', label: 'Absolutely not', expr: 'faint', usd: Infinity, phrases: [
      'I’m not crying, you are.', 'This cat has left the chat.', 'Goodbye, savings.', 'No. Nope. Never.',
      'Bury me with the receipt.', 'Call the fire department.'] },
  ];

  // A phrase for the mood; random unless `pick` (0..1) is given.
  function moodPhrase(mood, pick = Math.random()) {
    const list = mood && mood.phrases;
    if (!list || !list.length) return '';
    return list[Math.min(list.length - 1, Math.floor(pick * list.length))];
  }

  // Upper bounds in hours: 15 min, 1 h, 1 workday, 1 work week (5 days), 1 work month.
  function moodHourBounds(income) {
    const day = income.hoursPerDay;
    const month = income.hoursPerDay * income.daysPerMonth;
    const b = [0.25, 1, day, Math.min(day * 5, month), month, Infinity];
    for (let i = 1; i < b.length; i++) b[i] = Math.max(b[i], b[i - 1]); // keep them increasing
    return b;
  }

  function moodFor(hours, income, usdAmount) {
    let i;
    if (hours != null && validIncome(income)) {
      const b = moodHourBounds(income);
      i = b.findIndex((x) => hours < x);
    } else if (usdAmount != null && Number.isFinite(usdAmount)) {
      i = MOODS.findIndex((m) => usdAmount < m.usd);
    } else {
      i = 2;
    }
    return MOODS[i < 0 ? MOODS.length - 1 : i];
  }

  // Human-readable range for each mood, e.g. "15 min – 1 h (≈ Rs 360–1,420)" or "under ≈ Rs 1,650".
  function moodRanges(income, homeCurrency, table) {
    const span = (i, lo, hi, fmt) =>
      i === 0 ? `under ${fmt(hi)}` : hi === Infinity ? `${fmt(lo)} or more` : `${fmt(lo)} – ${fmt(hi)}`;
    if (validIncome(income)) {
      const b = moodHourBounds(income);
      const hourly = hourlyRate(income, homeCurrency, table);
      return MOODS.map((m, i) => {
        const lo = i ? b[i - 1] : 0;
        const hi = b[i];
        let range = span(i, lo, hi, (h) => formatWorkShort(h, income));
        if (hourly) {
          range += i === 0 ? ` (under ≈ ${formatMoney(hi * hourly, homeCurrency)})`
            : hi === Infinity ? ` (≈ ${formatMoney(lo * hourly, homeCurrency)}+)`
            : ` (≈ ${formatMoneyRange(lo * hourly, hi * hourly, homeCurrency)})`;
        }
        return { ...m, range, empty: lo === hi };
      });
    }
    const cur = convert(1, 'USD', homeCurrency, table) == null ? 'USD' : homeCurrency;
    const inCur = (usd) => convert(usd, 'USD', cur, table);
    return MOODS.map((m, i) => {
      const lo = i ? inCur(MOODS[i - 1].usd) : 0;
      const range = i === 0 ? `under ≈ ${formatMoney(inCur(m.usd), cur)}`
        : m.usd === Infinity ? `≈ ${formatMoney(lo, cur)} or more`
        : `≈ ${formatMoneyRange(lo, inCur(m.usd), cur)}`;
      return { ...m, range, empty: false };
    });
  }

  // "≈ Rs 15,200 · 🐾 2.4 h"
  function badgeText({ home, homeCurrency, homeHigh, hours, income, display }) {
    let s = `≈ ${formatMoneyRange(home, homeHigh, homeCurrency, display.rounding)}`;
    if (display.showWork && hours != null && validIncome(income)) {
      s += ` · 🐾 ${homeHigh != null ? '≤ ' : ''}${formatWorkShort(hours, income)}`;
    }
    return s;
  }

  CL.convert = {
    rateOf, crossRate, convert, validIncome, hourlyRate, hoursNeeded, workUnit,
    formatWorkShort, formatWorkLong, formatMoney, formatMoneyRange, formatPrecise, formatOriginal,
    formatRate, MOODS, moodFor, moodRanges, moodPhrase, badgeText, symbolFor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CL.convert;
})(globalThis);
