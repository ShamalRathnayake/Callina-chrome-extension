'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { THEMES, TOKENS, DEFAULT_THEME, themeOf, themeCss } = require('../shared/themes.js');
const { normalizeSettings, DEFAULT_SETTINGS } = require('../shared/settings.js');

test('every preset defines every token in both palettes', () => {
  for (const [id, t] of Object.entries(THEMES)) {
    assert.ok(t.name && t.blurb, id);
    for (const p of [t.light, t.dark]) {
      assert.ok(p.scheme === 'light' || p.scheme === 'dark', id);
      for (const k of Object.keys(TOKENS)) assert.equal(typeof p[k], 'string', `${id}.${k}`);
    }
  }
});

test('the default setting is a real preset', () => {
  assert.ok(Object.hasOwn(THEMES, DEFAULT_THEME));
  assert.equal(DEFAULT_SETTINGS.theme, DEFAULT_THEME);
});

test('unknown theme ids fall back to the default', () => {
  assert.equal(themeOf('nope'), THEMES[DEFAULT_THEME]);
  assert.equal(themeOf('__proto__'), THEMES[DEFAULT_THEME]);
});

test('themeCss switches with the system scheme, with an optional prefix', () => {
  const css = themeCss('matcha', ':host', 'cl-');
  assert.match(css, /^:host\{color-scheme:light;--cl-bg:#f3f8ef;/);
  assert.match(css, /@media \(prefers-color-scheme:dark\)\{:host\{color-scheme:dark;/);
  assert.match(css, /--cl-accent-strong:/);
  // A single-palette preset has no media query.
  assert.doesNotMatch(themeCss('midnight'), /@media/);
});

test('normalizeSettings keeps a theme id and rejects junk', () => {
  assert.equal(normalizeSettings({ theme: 'sakura' }).theme, 'sakura');
  assert.equal(normalizeSettings({ theme: '}body{x' }).theme, DEFAULT_THEME);
  assert.equal(normalizeSettings({ theme: 3 }).theme, DEFAULT_THEME);
  assert.equal(normalizeSettings({}).theme, DEFAULT_THEME);
});
