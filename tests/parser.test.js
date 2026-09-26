'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../shared/currencies.js');
const { parseNumber, findPrices, exactPrice, resolveCurrency, tldOf, currencyFromJsonLd } = require('../content/parser.js');

const one = (text, ctx) => {
  const found = findPrices(text, ctx);
  assert.equal(found.length, 1, `expected exactly one price in ${JSON.stringify(text)}, got ${JSON.stringify(found)}`);
  return found[0];
};
const none = (text, ctx) => assert.deepEqual(findPrices(text, ctx), [], `expected no price in ${JSON.stringify(text)}`);

test('§5.2 number disambiguation', () => {
  assert.equal(parseNumber('1,234.56'), 1234.56); // comma thousands, dot decimal
  assert.equal(parseNumber('1.234,56'), 1234.56); // dot thousands, comma decimal
  assert.equal(parseNumber('1 234,56'), 1234.56); // space thousands
  assert.equal(parseNumber('1 234,56'), 1234.56); // narrow no-break space
  assert.equal(parseNumber('1 234'), 1234); // no-break space
  assert.equal(parseNumber('1,234'), 1234); // single sep + 3 digits → thousands
  assert.equal(parseNumber('1.234'), 1234);
  assert.equal(parseNumber('49.9'), 49.9); // single sep + 1–2 digits → decimal
  assert.equal(parseNumber('49,99'), 49.99);
  assert.equal(parseNumber('1234'), 1234);
  assert.equal(parseNumber('1.234.567'), 1234567); // repeated → thousands
  assert.equal(parseNumber('1,234,567.8'), 1234567.8);
  assert.equal(parseNumber("1'234.50"), 1234.5); // Swiss apostrophe
  assert.equal(parseNumber('0.500'), 0.5);
});

test('§5.1 symbols before and after the number', () => {
  const cases = [
    ['$49.99', 'USD', 49.99], ['€1.299,00', 'EUR', 1299], ['£20', 'GBP', 20], ['¥3,000', 'JPY', 3000],
    ['₹499', 'INR', 499], ['₩12,000', 'KRW', 12000], ['₽990', 'RUB', 990], ['₺150', 'TRY', 150],
    ['₫250.000', 'VND', 250000], ['฿1,200', 'THB', 1200], ['₱999', 'PHP', 999], ['R$ 59,90', 'BRL', 59.9],
    ['A$25', 'AUD', 25], ['C$30', 'CAD', 30], ['CA$30', 'CAD', 30], ['S$12', 'SGD', 12], ['HK$88', 'HKD', 88],
    ['NZ$40', 'NZD', 40], ['US$15', 'USD', 15], ['RM 45.50', 'MYR', 45.5], ['199 kr', 'SEK', 199],
    ['49,99 zł', 'PLN', 49.99], ['Fr. 12.50', 'CHF', 12.5], ['CHF 12.50', 'CHF', 12.5], ['3000円', 'JPY', 3000],
    ['CN¥88', 'CNY', 88], ['JP¥500', 'JPY', 500], ['1.299,00 €', 'EUR', 1299], ['49.99$', 'USD', 49.99],
    ['$ 49', 'USD', 49], ['€ 10', 'EUR', 10], ['1 234,56 €', 'EUR', 1234.56], ['1 234,56 €', 'EUR', 1234.56],
  ];
  for (const [text, cur, amount] of cases) {
    const p = one(text, { homeCurrency: 'LKR' });
    assert.equal(p.currency, cur, text);
    assert.equal(p.amount, amount, text);
    assert.equal(p.raw, text, text);
  }
});

test('§5.1 ISO codes in either order, with or without space', () => {
  assert.deepEqual([one('USD 49').currency, one('USD 49').amount], ['USD', 49]);
  assert.deepEqual([one('49 USD').currency, one('49 USD').amount], ['USD', 49]);
  assert.deepEqual([one('EUR49').currency, one('EUR49').amount], ['EUR', 49]);
  assert.deepEqual([one('49EUR').currency, one('49EUR').amount], ['EUR', 49]);
  assert.equal(one('Price: GBP 1,250.00 incl. VAT').amount, 1250);
  none('USDT 49'); // not a known code
  none('ABCUSD 49');
  none('PHP 8.2 is out'); // programming language, not pesos
});

test('Rs / Rs. prefix', () => {
  assert.equal(one('Rs. 1,500', { homeCurrency: 'USD' }).amount, 1500);
  assert.equal(one('Rs.1500', { homeCurrency: 'USD' }).currency, 'INR');
  assert.equal(one('Rs 1500', { homeCurrency: 'LKR' }).currency, 'LKR');
  none('Hours 5'); // "rs" glued to a word
});

test('magnitude suffixes', () => {
  assert.equal(one('$1.2k').amount, 1200);
  assert.equal(one('$3M').amount, 3e6);
  assert.equal(one('£5m').amount, 5e6);
  assert.equal(one('$2 billion').amount, 2e9);
  assert.equal(one('$5 minimum').amount, 5); // "m" of minimum isn't a suffix
});

test('ranges', () => {
  const both = findPrices('$10 – $20');
  assert.equal(both.length, 2);
  assert.deepEqual(both.map((p) => p.amount), [10, 20]);

  const r = one('$10–20');
  assert.equal(r.amount, 10);
  assert.equal(r.amountHigh, 20);
  assert.equal(r.raw, '$10–20');

  assert.equal(one('$10 to $20'.replace(' to $', ' to ')).amountHigh, 20);

  const s = one('10-20 €');
  assert.equal(s.amount, 10);
  assert.equal(s.amountHigh, 20);
  assert.equal(s.raw, '10-20 €');
});

test('multiple prices in one string keep correct offsets', () => {
  const text = 'Was $59.99, now €45 or 49 GBP';
  const found = findPrices(text);
  assert.deepEqual(found.map((p) => p.raw), ['$59.99', '€45', '49 GBP']);
  for (const p of found) assert.equal(text.slice(p.start, p.end), p.raw);
});

test('non-prices are ignored', () => {
  none('Released on 2024-05-01');
  none('Call +1 (555) 123-4567');
  none('Version v1.2.3 is out');
  none('Save 20% today');
  none('$5% off'); // percentage
  none('1.2.3 USD');
  none('Meet at 10:30');
  none('Chapter 12, page 3');
  none('100 kroner'); // "kr" glued to a word
  none('FIRM 50');
});

test('"20 $50" reads as $50, not "20 $"', () => {
  const p = one('Save 20 $50 off');
  assert.equal(p.amount, 50);
  assert.equal(p.raw, '$50');
});

test('home-currency prices are flagged', () => {
  assert.equal(one('LKR 1,500', { homeCurrency: 'LKR' }).isHome, true);
  assert.equal(one('$5', { homeCurrency: 'LKR' }).isHome, false);
  assert.equal(one('$5', { homeCurrency: 'USD' }).isHome, true);
});

test('§5.3 ambiguity: 1. explicit prefix beats everything', () => {
  const ctx = { pageCurrency: 'CAD', dollarOverride: 'AUD', tld: 'nz' };
  assert.equal(one('US$10', ctx).currency, 'USD');
  assert.equal(one('A$10', ctx).currency, 'AUD');
  assert.equal(one('C$10', ctx).currency, 'CAD');
  assert.equal(one('HK$10', ctx).currency, 'HKD');
  assert.equal(one('CN¥10', { tld: 'jp' }).currency, 'CNY');
  assert.equal(one('JP¥10', { tld: 'cn' }).currency, 'JPY');
});

test('§5.3 ambiguity: 2. page structured data', () => {
  const p = one('$10', { pageCurrency: 'CAD', dollarOverride: 'AUD', tld: 'nz' });
  assert.equal(p.currency, 'CAD');
  assert.equal(p.via, 'page');
  // page currency that $ can't mean is ignored
  assert.equal(one('$10', { pageCurrency: 'EUR', tld: 'nz' }).currency, 'NZD');
  assert.equal(one('¥10', { pageCurrency: 'CNY' }).currency, 'CNY');
});

test('§5.3 ambiguity: 3. per-site $ override', () => {
  const p = one('$10', { dollarOverride: 'AUD', tld: 'ca' });
  assert.equal(p.currency, 'AUD');
  assert.equal(p.via, 'override');
  // override only applies to $
  assert.equal(one('¥10', { dollarOverride: 'AUD' }).currency, 'JPY');
});

test('§5.3 ambiguity: 4. TLD', () => {
  assert.equal(one('$10', { tld: tldOf('shop.example.ca') }).currency, 'CAD');
  assert.equal(one('$10', { tld: tldOf('www.store.com.au') }).currency, 'AUD');
  assert.equal(one('¥10', { tld: tldOf('taobao.cn') }).currency, 'CNY');
  assert.equal(one('¥10', { tld: tldOf('amazon.co.jp') }).currency, 'JPY');
  assert.equal(one('Rs 10', { tld: tldOf('daraz.lk'), homeCurrency: 'USD' }).currency, 'LKR');
  assert.equal(one('Rs 10', { tld: tldOf('flipkart.in'), homeCurrency: 'LKR' }).currency, 'INR');
  assert.equal(one('100 kr', { tld: 'no' }).currency, 'NOK');
  assert.equal(one('100 kr', { tld: 'dk' }).currency, 'DKK');
  assert.equal(one('$10', { tld: tldOf('shop.de') }).currency, 'USD'); // EUR TLD doesn't change $
  assert.equal(one('$10', { tld: 'ca' }).via, 'tld');
});

test('§5.3 ambiguity: 5. defaults', () => {
  assert.equal(one('$10').currency, 'USD');
  assert.equal(one('¥10').currency, 'JPY');
  assert.equal(one('Rs 10', { homeCurrency: 'LKR' }).currency, 'LKR');
  assert.equal(one('Rs 10', { homeCurrency: 'EUR' }).currency, 'INR');
  assert.equal(one('100 kr').currency, 'SEK');
  assert.equal(resolveCurrency('$', {}).via, 'default');
});

test('tldOf', () => {
  assert.equal(tldOf('www.amazon.com'), 'com');
  assert.equal(tldOf('www.amazon.co.uk'), 'co.uk');
  assert.equal(tldOf('shop.com.au'), 'com.au');
  assert.equal(tldOf('localhost'), 'localhost');
  assert.equal(tldOf(''), '');
});

test('exactPrice (split prices)', () => {
  assert.equal(exactPrice('$49.99').amount, 49.99);
  assert.equal(exactPrice('  $ 49.99 ').amount, 49.99);
  assert.equal(exactPrice('Only $49.99'), null);
  assert.equal(exactPrice('$49.99$49.99'), null);
  assert.equal(exactPrice('49'), null);
});

test('JSON-LD priceCurrency', () => {
  assert.equal(currencyFromJsonLd({ '@type': 'Product', offers: { price: '1', priceCurrency: 'cad' } }), 'CAD');
  assert.equal(currencyFromJsonLd([{ '@type': 'Org' }, { offers: [{ priceCurrency: 'AUD' }] }]), 'AUD');
  assert.equal(currencyFromJsonLd({ '@graph': [{ '@type': 'Product', offers: { priceSpecification: { priceCurrency: 'NZD' } } }] }), 'NZD');
  assert.equal(currencyFromJsonLd({ '@type': 'Article' }), null);
});
