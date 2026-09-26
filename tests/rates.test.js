'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../shared/rates.js');

const base = { usd: 1, eur: 0.9, gbp: 0.78, jpy: 150, cny: 7.2, inr: 83, lkr: 300, aud: 1.5, cad: 1.36, chf: 0.88, sgd: 1.34 };
const scaled = (k, f) => ({ ...base, [k]: base[k] * f });

test('cleanTable keeps positive numeric 3-letter codes', () => {
  const t = R.cleanTable({ EUR: 0.9, lkr: 300, bad: -1, nan: NaN, str: '5', toolong: 3, usd: 2 });
  assert.deepEqual(t, { eur: 0.9, lkr: 300, usd: 1 });
});

test('cleanDate', () => {
  assert.equal(R.cleanDate('2026-09-26'), '2026-09-26');
  assert.equal(R.cleanDate('<img src=x>'), 'unknown date');
  assert.equal(R.cleanDate(undefined), 'unknown date');
});

test('plausible: within 25 % of the cached table', () => {
  assert.equal(R.plausible(scaled('lkr', 1.2), base), true);
  assert.equal(R.plausible(scaled('lkr', 1.3), base), false);
  assert.equal(R.plausible(scaled('eur', 0.5), base), false);
  assert.equal(R.plausible(base, null), false); // nothing cached: needs a second source
});

test('agree: two sources within 5 %', () => {
  assert.equal(R.agree(base, scaled('lkr', 1.04)), true);
  assert.equal(R.agree(base, scaled('lkr', 1.1)), false);
});

test('isIconUrl accepts only small PNG data URLs', () => {
  assert.equal(R.isIconUrl('data:image/png;base64,AAAA'), true);
  assert.equal(R.isIconUrl('https://evil.example/x.png'), false);
  assert.equal(R.isIconUrl('data:image/svg+xml,<svg/>'), false);
  assert.equal(R.isIconUrl('data:image/png;base64,' + 'A'.repeat(200000)), false);
  assert.equal(R.isIconUrl(null), false);
});
