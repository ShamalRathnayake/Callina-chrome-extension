// Currency table, currency markers and TLD hints.
// Pure data + tiny helpers: no DOM, no chrome.* (also loaded by Node tests).
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});

  // symbol = what we print for amounts in this currency (e.g. the home currency).
  const CURRENCIES = {
    USD: { name: 'US Dollar', symbol: '$', decimals: 2 },
    EUR: { name: 'Euro', symbol: '€', decimals: 2 },
    GBP: { name: 'British Pound', symbol: '£', decimals: 2 },
    JPY: { name: 'Japanese Yen', symbol: '¥', decimals: 0 },
    CNY: { name: 'Chinese Yuan', symbol: 'CN¥', decimals: 2 },
    INR: { name: 'Indian Rupee', symbol: '₹', decimals: 2 },
    LKR: { name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2 },
    PKR: { name: 'Pakistani Rupee', symbol: 'PKR', decimals: 2 },
    NPR: { name: 'Nepalese Rupee', symbol: 'NPR', decimals: 2 },
    BDT: { name: 'Bangladeshi Taka', symbol: '৳', decimals: 2 },
    KRW: { name: 'South Korean Won', symbol: '₩', decimals: 0 },
    RUB: { name: 'Russian Ruble', symbol: '₽', decimals: 2 },
    TRY: { name: 'Turkish Lira', symbol: '₺', decimals: 2 },
    VND: { name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
    THB: { name: 'Thai Baht', symbol: '฿', decimals: 2 },
    PHP: { name: 'Philippine Peso', symbol: '₱', decimals: 2 },
    IDR: { name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0 },
    MYR: { name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
    SGD: { name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
    HKD: { name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
    TWD: { name: 'New Taiwan Dollar', symbol: 'NT$', decimals: 2 },
    AUD: { name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
    NZD: { name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
    CAD: { name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
    MXN: { name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
    BRL: { name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
    CHF: { name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
    SEK: { name: 'Swedish Krona', symbol: 'SEK', decimals: 2 },
    NOK: { name: 'Norwegian Krone', symbol: 'NOK', decimals: 2 },
    DKK: { name: 'Danish Krone', symbol: 'DKK', decimals: 2 },
    PLN: { name: 'Polish Złoty', symbol: 'zł', decimals: 2 },
    CZK: { name: 'Czech Koruna', symbol: 'Kč', decimals: 2 },
    HUF: { name: 'Hungarian Forint', symbol: 'Ft', decimals: 0 },
    UAH: { name: 'Ukrainian Hryvnia', symbol: '₴', decimals: 2 },
    ILS: { name: 'Israeli New Shekel', symbol: '₪', decimals: 2 },
    AED: { name: 'UAE Dirham', symbol: 'AED', decimals: 2 },
    SAR: { name: 'Saudi Riyal', symbol: 'SAR', decimals: 2 },
    ZAR: { name: 'South African Rand', symbol: 'ZAR', decimals: 2 },
    NGN: { name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
    KES: { name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
    EGP: { name: 'Egyptian Pound', symbol: 'E£', decimals: 2 },
  };

  // Ambiguous marker groups (§5.3). `candidates` are the currencies the marker can mean;
  // page data / overrides / TLD hints are only honoured if they are one of these.
  const AMBIGUOUS = {
    DOLLAR: { candidates: ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'TWD', 'MXN'], fallback: () => 'USD' },
    YEN: { candidates: ['JPY', 'CNY'], fallback: () => 'JPY' },
    KRONA: { candidates: ['SEK', 'NOK', 'DKK'], fallback: () => 'SEK' },
    RUPEE: { candidates: ['LKR', 'INR', 'PKR', 'NPR'], fallback: (home) => (home === 'LKR' ? 'LKR' : 'INR') },
  };

  // Text marker → { currency } (unambiguous) or { group } (ambiguous).
  const MARKERS = {
    // explicit dollar prefixes
    'US$': { currency: 'USD' }, 'U$S': { currency: 'USD' },
    'A$': { currency: 'AUD' }, 'AU$': { currency: 'AUD' },
    'C$': { currency: 'CAD' }, 'CA$': { currency: 'CAD' }, 'Can$': { currency: 'CAD' },
    'S$': { currency: 'SGD' }, 'HK$': { currency: 'HKD' }, 'NZ$': { currency: 'NZD' },
    'NT$': { currency: 'TWD' }, 'MX$': { currency: 'MXN' }, 'R$': { currency: 'BRL' },
    'JP¥': { currency: 'JPY' }, 'CN¥': { currency: 'CNY' }, '円': { currency: 'JPY' }, '元': { currency: 'CNY' },
    'RMB': { currency: 'CNY' },
    // single-currency symbols
    '€': { currency: 'EUR' }, '£': { currency: 'GBP' }, '₹': { currency: 'INR' }, '₩': { currency: 'KRW' },
    '₽': { currency: 'RUB' }, '₺': { currency: 'TRY' }, '₫': { currency: 'VND' }, '฿': { currency: 'THB' },
    '₱': { currency: 'PHP' }, '₪': { currency: 'ILS' }, '₴': { currency: 'UAH' }, '₦': { currency: 'NGN' },
    '৳': { currency: 'BDT' }, 'E£': { currency: 'EGP' }, 'රු': { currency: 'LKR' },
    'zł': { currency: 'PLN' }, 'Kč': { currency: 'CZK' }, 'Ft': { currency: 'HUF' }, 'Fr.': { currency: 'CHF' },
    'RM': { currency: 'MYR' }, 'Rp': { currency: 'IDR' }, 'KSh': { currency: 'KES' },
    // ambiguous
    '$': { group: 'DOLLAR' }, '＄': { group: 'DOLLAR' },
    '¥': { group: 'YEN' }, '￥': { group: 'YEN' },
    'kr': { group: 'KRONA' }, 'kr.': { group: 'KRONA' },
    'Rs': { group: 'RUPEE' }, 'Rs.': { group: 'RUPEE' },
  };
  // Every ISO code in the table is also a marker ("USD 49", "49 EUR", "EUR49").
  for (const code of Object.keys(CURRENCIES)) MARKERS[code] = { currency: code };

  // TLD → local currency; only used to pick a meaning for an ambiguous marker.
  const TLD_CURRENCY = {
    'us': 'USD', 'ca': 'CAD', 'au': 'AUD', 'com.au': 'AUD', 'net.au': 'AUD', 'nz': 'NZD', 'co.nz': 'NZD',
    'sg': 'SGD', 'com.sg': 'SGD', 'hk': 'HKD', 'com.hk': 'HKD', 'tw': 'TWD', 'com.tw': 'TWD',
    'mx': 'MXN', 'com.mx': 'MXN', 'jp': 'JPY', 'co.jp': 'JPY', 'cn': 'CNY', 'com.cn': 'CNY',
    'lk': 'LKR', 'in': 'INR', 'co.in': 'INR', 'pk': 'PKR', 'com.pk': 'PKR', 'np': 'NPR', 'com.np': 'NPR',
    'se': 'SEK', 'no': 'NOK', 'dk': 'DKK', 'uk': 'GBP', 'co.uk': 'GBP',
  };

  CL.CURRENCIES = CURRENCIES;
  CL.AMBIGUOUS = AMBIGUOUS;
  CL.MARKERS = MARKERS;
  CL.TLD_CURRENCY = TLD_CURRENCY;

  if (typeof module !== 'undefined' && module.exports) module.exports = { CURRENCIES, AMBIGUOUS, MARKERS, TLD_CURRENCY };
})(globalThis);
