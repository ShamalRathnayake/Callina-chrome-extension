// Settings defaults + normalisation. Pure (no chrome.*), shared by every context.
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});

  const DEFAULT_SETTINGS = {
    enabled: true,
    homeCurrency: 'LKR',
    income: { amount: null, currency: 'LKR', hoursPerDay: 8, daysPerMonth: 22 },
    display: { showWork: true, rounding: 'whole', style: 'subtle' },
    theme: 'caramel', // a preset id from shared/themes.js; unknown ids fall back to the default there
    mascot: 'loaf',
    // 'squad': a different cat per affordability mood; 'single': always `mascot`, only its face changes.
    moodMode: 'squad',
    moodCats: { pocket: 'vibe', treat: 'pop', fair: 'loaf', pricey: 'huh', ouch: 'screamer', nope: 'banana' },
    disabledSites: [],
    dollarOverrides: {},
  };

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  function normalizeSettings(stored) {
    const s = isObj(stored) ? stored : {};
    const d = DEFAULT_SETTINGS;
    return {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : d.enabled,
      homeCurrency: typeof s.homeCurrency === 'string' && /^[A-Z]{3}$/.test(s.homeCurrency) ? s.homeCurrency : d.homeCurrency,
      income: { ...d.income, ...(isObj(s.income) ? s.income : {}) },
      display: { ...d.display, ...(isObj(s.display) ? s.display : {}) },
      theme: typeof s.theme === 'string' && /^[a-z]+$/.test(s.theme) ? s.theme : d.theme,
      mascot: typeof s.mascot === 'string' ? s.mascot : d.mascot,
      moodMode: s.moodMode === 'single' ? 'single' : 'squad',
      moodCats: { ...d.moodCats, ...(isObj(s.moodCats) ? s.moodCats : {}) },
      disabledSites: Array.isArray(s.disabledSites) ? s.disabledSites.filter((x) => typeof x === 'string') : [],
      dollarOverrides: isObj(s.dollarOverrides) ? { ...s.dollarOverrides } : {},
    };
  }

  // Uploaded mascots: settings.mascot is "custom:<id>", the image lives in
  // chrome.storage.local under "customCat:<id>" (one key each, so pages load only the selected one).
  const MAX_CUSTOM_CATS = 6;
  const customKey = (mascot) =>
    typeof mascot === 'string' && /^custom:[\w-]+$/.test(mascot) ? 'customCat:' + mascot.slice(7) : null;

  // Which cat shows a given mood (see convert.js MOODS).
  const catForMood = (settings, moodId) =>
    settings.moodMode === 'squad' ? settings.moodCats[moodId] || settings.mascot : settings.mascot;

  // "www.shop.example" → "shop.example" — the key used for per-site settings.
  const siteKey = (hostname) => String(hostname || '').toLowerCase().replace(/^www\./, '');

  CL.settings = { DEFAULT_SETTINGS, normalizeSettings, siteKey, customKey, catForMood, MAX_CUSTOM_CATS };
  if (typeof module !== 'undefined' && module.exports) module.exports = CL.settings;
})(globalThis);
