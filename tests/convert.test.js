'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../shared/currencies.js');
const C = require('../content/convert.js');
const { normalizeSettings, siteKey, customKey, catForMood } = require('../shared/settings.js');

const table = { usd: 1, lkr: 300, eur: 0.8, jpy: 150, gbp: 0.75 };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} ≈ ${b}`);
const income = { amount: 176000, currency: 'LKR', hoursPerDay: 8, daysPerMonth: 22 }; // 1,000 LKR/h

test('cross rates through the USD base', () => {
  close(C.crossRate(table, 'USD', 'LKR'), 300);
  close(C.crossRate(table, 'EUR', 'LKR'), 375);
  close(C.crossRate(table, 'LKR', 'LKR'), 1);
  close(C.convert(10, 'EUR', 'JPY', table), 1875);
  assert.equal(C.crossRate(table, 'XYZ', 'LKR'), null);
  assert.equal(C.convert(10, 'USD', 'XYZ', table), null);
});

test('income validation', () => {
  assert.equal(C.validIncome(income), true);
  assert.equal(C.validIncome({ ...income, amount: null }), false);
  assert.equal(C.validIncome({ ...income, amount: -5 }), false);
  assert.equal(C.validIncome({ ...income, amount: 0 }), false);
  assert.equal(C.validIncome({ ...income, hoursPerDay: 25 }), false);
  assert.equal(C.validIncome({ ...income, hoursPerDay: 24 }), true);
  assert.equal(C.validIncome({ ...income, daysPerMonth: 32 }), false);
  assert.equal(C.validIncome({ ...income, daysPerMonth: 31 }), true);
  assert.equal(C.validIncome({ ...income, daysPerMonth: NaN }), false);
  assert.equal(C.validIncome(null), false);
});

test('hourly rate and hours needed', () => {
  close(C.hourlyRate(income, 'LKR', table), 1000);
  // income in USD, home LKR: 1760 USD/month → 528,000 LKR / 176 h = 3000 LKR/h
  close(C.hourlyRate({ ...income, amount: 1760, currency: 'USD' }, 'LKR', table), 3000);
  assert.equal(C.hourlyRate({ ...income, amount: '' }, 'LKR', table), null);
  close(C.hoursNeeded(2400, 1000), 2.4);
  assert.equal(C.hoursNeeded(2400, null), null);
});

test('work time, short form (§6 thresholds)', () => {
  assert.equal(C.formatWorkShort(35 / 60, income), '35 min');
  assert.equal(C.formatWorkShort(0.001, income), '1 min');
  assert.equal(C.formatWorkShort(0.9999, income), '1 h');
  assert.equal(C.formatWorkShort(2.4, income), '2.4 h');
  assert.equal(C.formatWorkShort(2, income), '2 h');
  assert.equal(C.formatWorkShort(28, income), '3.5 days'); // 8 h days
  assert.equal(C.formatWorkShort(8, income), '1 day');
  assert.equal(C.formatWorkShort(176 * 1.2, income), '1.2 months');
  assert.equal(C.formatWorkShort(176, income), '1 month');
});

test('work time, friendly words', () => {
  assert.equal(C.formatWorkLong(2.4, income), '≈ 2 hours 24 minutes of work');
  assert.equal(C.formatWorkLong(1, income), '≈ 1 hour of work');
  assert.equal(C.formatWorkLong(35 / 60, income), '≈ 35 minutes of work');
  assert.equal(C.formatWorkLong(1 / 60, income), '≈ 1 minute of work');
  assert.equal(C.formatWorkLong(28, income), '≈ 3.5 work days');
  assert.equal(C.formatWorkLong(176 * 1.2, income), '≈ 1.2 work months');
  assert.equal(C.formatWorkLong(7.999, income), '≈ 8 hours of work');
});

test('money formatting', () => {
  assert.equal(C.formatMoney(15200.4, 'LKR'), 'Rs 15,200');
  assert.equal(C.formatMoney(15200.4, 'LKR', '2dp'), 'Rs 15,200.40');
  assert.equal(C.formatMoney(3.456, 'USD'), '$3.46'); // small amounts keep cents
  assert.equal(C.formatMoney(1234.5, 'EUR'), '€1,235');
  assert.equal(C.formatMoney(1234.5, 'JPY', '2dp'), '¥1,235'); // JPY has no decimals
  assert.equal(C.formatMoney(10, 'XYZ'), 'XYZ 10');
  assert.equal(C.formatMoneyRange(3000, 6000, 'LKR'), 'Rs 3,000–6,000');
  assert.equal(C.formatPrecise(16498.345, 'LKR'), 'Rs 16,498.35');
  assert.equal(C.formatOriginal(49.99, 'USD'), 'USD 49.99');
  assert.equal(C.formatOriginal(3000, 'JPY'), 'JPY 3,000');
  assert.equal(C.formatOriginal(10, 'USD', 20), 'USD 10–20');
  assert.equal(C.formatRate('USD', 'LKR', 330.0327), '1 USD = 330.03 LKR');
  assert.equal(C.formatRate('JPY', 'USD', 0.0066789), '1 JPY = 0.006679 USD');
});

test('badge text', () => {
  const display = { showWork: true, rounding: 'whole', style: 'subtle' };
  const base = { home: 15200, homeCurrency: 'LKR', hours: 2.4, income, display };
  assert.equal(C.badgeText(base), '≈ Rs 15,200 · 🐾 2.4 h');
  assert.equal(C.badgeText({ ...base, display: { ...display, showWork: false } }), '≈ Rs 15,200');
  assert.equal(C.badgeText({ ...base, hours: null }), '≈ Rs 15,200');
  assert.equal(C.badgeText({ ...base, income: { ...income, amount: null } }), '≈ Rs 15,200');
  assert.equal(C.badgeText({ ...base, homeHigh: 30400, hours: 4.8 }), '≈ Rs 15,200–30,400 · 🐾 ≤ 4.8 h');
});

test('affordability moods by work time', () => {
  const m = (h) => C.moodFor(h, income).id;
  assert.equal(m(0.1), 'pocket'); // < 15 min
  assert.equal(m(0.5), 'treat'); // < 1 h
  assert.equal(m(3), 'fair'); // < 1 workday (8 h)
  assert.equal(m(20), 'pricey'); // < 1 work week (40 h)
  assert.equal(m(100), 'ouch'); // < 1 work month (176 h)
  assert.equal(m(200), 'nope');
  assert.deepEqual(C.MOODS.map((x) => x.expr), ['love', 'happy', 'idle', 'worried', 'shocked', 'faint']);
  // short working month: the "work week" bound never passes the month
  const part = { ...income, hoursPerDay: 4, daysPerMonth: 3 }; // month = 12 h < week
  assert.equal(C.moodFor(11, part).id, 'pricey');
  assert.equal(C.moodFor(12, part).id, 'nope');
});

test('affordability moods by price when income is not set', () => {
  const m = (usd) => C.moodFor(null, null, usd).id;
  assert.equal(m(3), 'pocket');
  assert.equal(m(20), 'treat');
  assert.equal(m(60), 'fair');
  assert.equal(m(300), 'pricey');
  assert.equal(m(1000), 'ouch');
  assert.equal(m(9000), 'nope');
  assert.equal(C.moodFor(null, null, null).id, 'fair');
});

test('mood phrases', () => {
  for (const m of C.MOODS) {
    assert.ok(m.phrases.length >= 5, `${m.id} has enough phrases`);
    assert.equal(new Set(m.phrases).size, m.phrases.length, `${m.id} phrases are unique`);
    for (const p of m.phrases) assert.ok(p.length <= 32, `"${p}" fits the speech bubble`);
    assert.equal(C.moodPhrase(m, 0), m.phrases[0]);
    assert.equal(C.moodPhrase(m, 0.9999), m.phrases[m.phrases.length - 1]);
    assert.ok(m.phrases.includes(C.moodPhrase(m)));
  }
  assert.equal(C.moodPhrase(null), '');
});

test('mood range descriptions', () => {
  const work = C.moodRanges(income, 'LKR', table); // 1,000 LKR/h
  assert.equal(work[0].range, 'under 15 min (under ≈ Rs 250)');
  assert.equal(work[1].range, '15 min – 1 h (≈ Rs 250–1,000)');
  assert.equal(work[2].range, '1 h – 1 day (≈ Rs 1,000–8,000)');
  assert.equal(work[3].range, '1 day – 5 days (≈ Rs 8,000–40,000)');
  assert.equal(work[5].range, '1 month or more (≈ Rs 176,000+)');
  assert.equal(C.moodRanges({ ...income, hoursPerDay: 4, daysPerMonth: 3 }, 'LKR', table)[4].empty, true);
  const price = C.moodRanges({ ...income, amount: null }, 'LKR', table); // 300 LKR/USD
  assert.equal(price[0].range, 'under ≈ Rs 1,500');
  assert.equal(price[1].range, '≈ Rs 1,500–7,500');
  assert.equal(price[5].range, '≈ Rs 750,000 or more');
});

test('settings normalisation', () => {
  const s = normalizeSettings(undefined);
  assert.equal(s.homeCurrency, 'LKR');
  assert.equal(s.enabled, true);
  const t = normalizeSettings({ homeCurrency: 'eur', display: { style: 'bold' }, disabledSites: ['a.com', 5] });
  assert.equal(t.homeCurrency, 'LKR'); // invalid code rejected
  assert.equal(t.display.style, 'bold');
  assert.equal(t.display.rounding, 'whole');
  assert.deepEqual(t.disabledSites, ['a.com']);
  assert.equal(siteKey('WWW.Amazon.com'), 'amazon.com');
  assert.equal(customKey('custom:c1ab'), 'customCat:c1ab');
  assert.equal(customKey('loaf'), null);
  assert.equal(customKey('custom'), null); // legacy single-upload id
  assert.equal(customKey('custom:../x'), null);
  // mood cats
  assert.equal(catForMood(s, 'nope'), 'banana');
  const mine = normalizeSettings({ mascot: 'judge', moodCats: { nope: 'void' } });
  assert.equal(catForMood(mine, 'nope'), 'void');
  assert.equal(catForMood(mine, 'pocket'), 'vibe'); // defaults kept for the rest
  assert.equal(catForMood({ ...mine, moodMode: 'single' }, 'nope'), 'judge');
});
