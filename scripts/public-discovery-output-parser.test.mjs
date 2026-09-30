import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attribute, tags, elements, bodyText } from './public-discovery-output-parser.mjs';

test('menu names inside hydration scripts cannot prove server-visible dishes', () => {
  const html =
    '<body><script>"Dish only in JavaScript"</script><style>/* Dish in CSS */</style><h1>Real heading</h1><p>Visible dish</p></body>';
  assert.equal(bodyText(html).trim(), 'Real heading Visible dish');
  assert.doesNotMatch(bodyText(html), /JavaScript|CSS/);
});

test('sitemap entries cannot be confused with the containing urlset', () => {
  const xml = '<urlset><url><loc>first</loc></url><url><loc>second</loc></url></urlset>';
  assert.deepEqual(
    elements(xml, 'url').map(({ body }) => elements(body, 'loc')[0].body),
    ['first', 'second'],
  );
  assert.deepEqual(elements('<urlset></urlset>', 'url'), []);
});

test('language links preserve escaped query separators and exact element boundaries', () => {
  const html =
    '<link rel="alternate" hreflang="fr" href="https://fixture.test/fr/menu?view=bundles&amp;bundlesPage=2"/><linkage>ignored</linkage>';
  const links = tags(html, 'link');
  assert.equal(links.length, 1);
  assert.equal(attribute(links[0], 'hreflang'), 'fr');
  assert.equal(attribute(links[0], 'href'), 'https://fixture.test/fr/menu?view=bundles&bundlesPage=2');
  assert.equal(attribute('<link title="İstanbul" hrefLang="tr" href="/tr"/>', 'hreflang'), 'tr');
  assert.equal(attribute('<link title="İstanbul" hrefLang="tr" href="/tr"/>', 'href'), '/tr');
});
