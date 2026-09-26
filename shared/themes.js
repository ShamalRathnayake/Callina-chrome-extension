// Colour theme presets. Pure (no chrome.*, no DOM), shared by every context.
// Each preset has a light and a dark palette; the one used follows the system setting,
// except presets whose two palettes are the same (e.g. Midnight is always dark).
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});

  // Token → CSS custom property. Extension pages use the short names (var(--bg) …);
  // badges/tooltips on web pages use the --cl- prefixed ones inside their shadow roots.
  const TOKENS = {
    bg: 'page background', fg: 'text', muted: 'secondary text', line: 'borders', card: 'card background',
    accent: 'accent', accentStrong: 'accent border / link', onAccent: 'text on accent',
    accentSoft: 'subtle badge fill', accentEdge: 'subtle badge border', work: 'work-time text',
    ok: 'success', bad: 'error', switchOff: 'switch track (off)', shadow: 'tooltip shadow',
  };

  const caramelLight = {
    scheme: 'light', bg: '#fdf7ee', fg: '#2a1d10', muted: '#8a735c', line: '#efdcc2', card: '#fffdf8',
    accent: '#f6aa4b', accentStrong: '#b86f14', onAccent: '#2a1703',
    accentSoft: 'rgba(246,170,75,.16)', accentEdge: 'rgba(246,170,75,.6)', work: '#b15f00',
    ok: '#2e8b57', bad: '#c0392b', switchOff: '#d8cbbb', shadow: 'rgba(40,25,5,.22)',
  };
  const caramelDark = {
    scheme: 'dark', bg: '#1a1510', fg: '#f7ebdc', muted: '#bda78c', line: '#3b2e21', card: '#251e17',
    accent: '#f6aa4b', accentStrong: '#ffbb66', onAccent: '#2a1703',
    accentSoft: 'rgba(246,170,75,.18)', accentEdge: 'rgba(246,170,75,.6)', work: '#ffb757',
    ok: '#6fd39b', bad: '#ff8a7a', switchOff: '#5a4a39', shadow: 'rgba(0,0,0,.5)',
  };
  const midnight = {
    scheme: 'dark', bg: '#12131f', fg: '#e8e6ff', muted: '#9d9bc4', line: '#2c2d47', card: '#1b1c2e',
    accent: '#a78bfa', accentStrong: '#c4b5fd', onAccent: '#1a1033',
    accentSoft: 'rgba(167,139,250,.18)', accentEdge: 'rgba(167,139,250,.6)', work: '#c4b5fd',
    ok: '#6ee7b7', bad: '#fb7185', switchOff: '#3f4063', shadow: 'rgba(0,0,0,.55)',
  };

  const THEMES = {
    caramel: { name: 'Caramel', blurb: 'Warm and toasty (the original)', light: caramelLight, dark: caramelDark },
    matcha: {
      name: 'Matcha', blurb: 'Calm green tea',
      light: {
        scheme: 'light', bg: '#f3f8ef', fg: '#1c2a18', muted: '#62775a', line: '#d3e3c9', card: '#fbfdf9',
        accent: '#7cc46a', accentStrong: '#3f7f2f', onAccent: '#11260a',
        accentSoft: 'rgba(124,196,106,.18)', accentEdge: 'rgba(124,196,106,.65)', work: '#3a7a2a',
        ok: '#2e8b57', bad: '#c0392b', switchOff: '#c5d3bd', shadow: 'rgba(20,40,15,.2)',
      },
      dark: {
        scheme: 'dark', bg: '#121a10', fg: '#e5f2df', muted: '#a0b897', line: '#2a3a25', card: '#1a2517',
        accent: '#8fd67c', accentStrong: '#a8e699', onAccent: '#11260a',
        accentSoft: 'rgba(143,214,124,.18)', accentEdge: 'rgba(143,214,124,.6)', work: '#a8e699',
        ok: '#6fd39b', bad: '#ff8a7a', switchOff: '#3d5236', shadow: 'rgba(0,0,0,.5)',
      },
    },
    blueberry: {
      name: 'Blueberry', blurb: 'Cool and crisp',
      light: {
        scheme: 'light', bg: '#f1f5fc', fg: '#15213a', muted: '#5f6f8c', line: '#d2ddf0', card: '#fbfcff',
        accent: '#5b9df5', accentStrong: '#1f5fbf', onAccent: '#071a3a',
        accentSoft: 'rgba(91,157,245,.16)', accentEdge: 'rgba(91,157,245,.6)', work: '#1f5fbf',
        ok: '#2e8b57', bad: '#c0392b', switchOff: '#c3cde0', shadow: 'rgba(10,25,60,.2)',
      },
      dark: {
        scheme: 'dark', bg: '#0f1522', fg: '#e3ebfa', muted: '#98a8c6', line: '#26314a', card: '#172033',
        accent: '#6aa8ff', accentStrong: '#9cc4ff', onAccent: '#071a3a',
        accentSoft: 'rgba(106,168,255,.18)', accentEdge: 'rgba(106,168,255,.6)', work: '#9cc4ff',
        ok: '#6fd39b', bad: '#ff8a7a', switchOff: '#34435f', shadow: 'rgba(0,0,0,.5)',
      },
    },
    sakura: {
      name: 'Sakura', blurb: 'Soft cherry blossom',
      light: {
        scheme: 'light', bg: '#fdf3f6', fg: '#3a1624', muted: '#8f6475', line: '#f3d3de', card: '#fffafc',
        accent: '#f28bb0', accentStrong: '#c2416f', onAccent: '#3a0b1d',
        accentSoft: 'rgba(242,139,176,.16)', accentEdge: 'rgba(242,139,176,.6)', work: '#b2365f',
        ok: '#2e8b57', bad: '#c0392b', switchOff: '#e3c6d1', shadow: 'rgba(60,15,30,.2)',
      },
      dark: {
        scheme: 'dark', bg: '#1d1116', fg: '#fbe6ee', muted: '#c79aab', line: '#3e2530', card: '#281820',
        accent: '#f59ac0', accentStrong: '#ffb8d3', onAccent: '#3a0b1d',
        accentSoft: 'rgba(245,154,192,.18)', accentEdge: 'rgba(245,154,192,.6)', work: '#ffb8d3',
        ok: '#6fd39b', bad: '#ff8a7a', switchOff: '#553846', shadow: 'rgba(0,0,0,.5)',
      },
    },
    graphite: {
      name: 'Graphite', blurb: 'Quiet greys, no fuss',
      light: {
        scheme: 'light', bg: '#f4f4f5', fg: '#18181b', muted: '#6b6b74', line: '#dcdce0', card: '#ffffff',
        accent: '#52525b', accentStrong: '#27272a', onAccent: '#ffffff',
        accentSoft: 'rgba(82,82,91,.1)', accentEdge: 'rgba(82,82,91,.45)', work: '#3f3f46',
        ok: '#2e8b57', bad: '#c0392b', switchOff: '#c9c9cf', shadow: 'rgba(0,0,0,.18)',
      },
      dark: {
        scheme: 'dark', bg: '#141416', fg: '#ececef', muted: '#a1a1aa', line: '#2e2e33', card: '#1d1d21',
        accent: '#d4d4d8', accentStrong: '#f4f4f5', onAccent: '#18181b',
        accentSoft: 'rgba(212,212,216,.12)', accentEdge: 'rgba(212,212,216,.45)', work: '#e4e4e7',
        ok: '#6fd39b', bad: '#ff8a7a', switchOff: '#45454d', shadow: 'rgba(0,0,0,.55)',
      },
    },
    midnight: { name: 'Midnight', blurb: 'Always dark, a little violet', light: midnight, dark: midnight },
  };

  const DEFAULT_THEME = 'caramel';
  const themeOf = (id) => THEMES[Object.hasOwn(THEMES, id) ? id : DEFAULT_THEME];

  const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  function declarations(palette, prefix) {
    let out = `color-scheme:${palette.scheme};`;
    for (const k of Object.keys(TOKENS)) out += `--${prefix}${kebab(k)}:${palette[k]};`;
    return out;
  }

  // CSS that defines the theme's custom properties on `selector`, switching palettes with the system scheme.
  function themeCss(id, selector = ':root', prefix = '') {
    const t = themeOf(id);
    const light = `${selector}{${declarations(t.light, prefix)}}`;
    if (t.light === t.dark) return light;
    return `${light}@media (prefers-color-scheme:dark){${selector}{${declarations(t.dark, prefix)}}}`;
  }

  CL.themes = { THEMES, TOKENS, DEFAULT_THEME, themeOf, themeCss };
  if (typeof module !== 'undefined' && module.exports) module.exports = CL.themes;
})(globalThis);
