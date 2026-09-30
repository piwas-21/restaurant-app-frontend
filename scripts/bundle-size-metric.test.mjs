import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstLoadJavaScript } from './bundle-size-metric.mjs';

const manifest = {
  '/layout': ['root.js', 'translations.js', 'style.css'],
  '/(guest)/layout': ['translations.js', 'guest.js'],
  '/(guest)/[locale]/layout': ['locale.js'],
  '/(guest)/[locale]/menu/layout': ['menu.js'],
  '/(staff)/layout': ['private.js'],
  '/(guest)/[locale]/menu/page': ['page.js', 'translations.js'],
  '/page': ['home.js'],
};

test('counts every inherited layout once and excludes unrelated route groups', () => {
  assert.deepEqual(firstLoadJavaScript(manifest, '/(guest)/[locale]/menu/page').sort(), [
    'guest.js',
    'locale.js',
    'menu.js',
    'page.js',
    'root.js',
    'translations.js',
  ]);
});

test('root page inherits root layout without borrowing child layouts', () => {
  assert.deepEqual(firstLoadJavaScript(manifest, '/page').sort(), ['home.js', 'root.js', 'translations.js']);
});

test('shared chunk relocation cannot change the measured first-load assets', () => {
  const relocated = {
    ...manifest,
    '/layout': ['root.js', 'style.css'],
    '/page': ['home.js', 'translations.js'],
  };
  assert.deepEqual(firstLoadJavaScript(relocated, '/page').sort(), firstLoadJavaScript(manifest, '/page').sort());
});

test('adding a layout-only chunk changes the measured payload', () => {
  const expanded = { ...manifest, '/layout': [...manifest['/layout'], 'regression.js'] };
  assert.deepEqual(firstLoadJavaScript(expanded, '/page').sort(), [
    'home.js',
    'regression.js',
    'root.js',
    'translations.js',
  ]);
  assert.notDeepEqual(firstLoadJavaScript(expanded, '/page'), firstLoadJavaScript(manifest, '/page'));
});
