import assert from 'node:assert/strict';
import { CANONICAL_ORIGIN, CATEGORY_ID } from './public-discovery-fixture.mjs';
import { attribute, tags, elements, bodyText } from './public-discovery-output-parser.mjs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Accept-Language': 'en-US,en;q=0.9',
  'x-tenant-public-locale': 'en',
};
const TENANT_LOCALES = ['en', 'tr', 'es', 'ar', 'de', 'fr', 'nl', 'it', 'ru', 'zh'];
export const alternates = (html) =>
  Object.fromEntries(
    tags(headHtml(html), 'link')
      .filter((tag) => attribute(tag, 'rel') === 'alternate')
      .map((tag) => [attribute(tag, 'hreflang'), attribute(tag, 'href')]),
  );
const canonical = (html) =>
  tags(headHtml(html), 'link')
    .filter((tag) => attribute(tag, 'rel') === 'canonical')
    .map((tag) => attribute(tag, 'href'));
const robots = (html) =>
  tags(headHtml(html), 'meta')
    .filter((tag) => attribute(tag, 'name') === 'robots')
    .map((tag) => attribute(tag, 'content'))
    .join(' ');

function headHtml(html) {
  const match = html.match(/<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i);
  assert.ok(match, 'The emitted document has a head section');
  return match[1];
}

export async function htmlAt(origin, path) {
  const response = await fetch(origin + path, { headers, redirect: 'manual' });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html\b/i);
  return response.text();
}
function pageContract(html, path, locale, indexed) {
  assert.equal(attribute(tags(html, 'html')[0], 'lang'), locale, `${path}: explicit URL language`);
  assert.equal(attribute(tags(html, 'html')[0], 'dir'), locale === 'ar' ? 'rtl' : 'ltr');
  assert.deepEqual(canonical(html), [CANONICAL_ORIGIN + path]);
  assert.equal(/noindex/.test(robots(html)), !indexed, `${path}: robots ${robots(html)}`);
  const titles = elements(html, 'title');
  assert.equal(titles.length, 1, `${path}: one title`);
  assert.ok(bodyText(titles[0].body).trim(), `${path}: nonempty title`);
  assert.ok(
    elements(html, 'h1').some(({ body }) => bodyText(body).trim()),
    `${path}: visible heading`,
  );
  const descriptions = tags(html, 'meta').filter((tag) => attribute(tag, 'name') === 'description');
  assert.equal(descriptions.length, 1, `${path}: one description`);
  assert.ok(attribute(descriptions[0], 'content')?.trim(), `${path}: nonempty description`);
  assert.ok(bodyText(html).length > 100, `${path}: meaningful non-script HTML`);
}
function cluster(html, path, locales) {
  const suffix = path.replace(/^\/[a-z]+/, '');
  const expected = Object.fromEntries(locales.map((locale) => [locale, `${CANONICAL_ORIGIN}/${locale}${suffix}`]));
  if (locales.includes('fr')) expected['x-default'] = `${CANONICAL_ORIGIN}/fr${suffix}`;
  assert.equal(
    tags(html, 'link').filter((tag) => attribute(tag, 'rel') === 'alternate').length,
    Object.keys(expected).length,
    `${path}: no duplicate alternatives`,
  );
  assert.deepEqual(alternates(html), expected, `${path}: complete audited alternate cluster`);
}

function assertTemplate(first, scenario, template) {
  const emittedHeaders = tags(first, 'header');
  assert.ok(emittedHeaders.length > 0, 'A customer header is server-rendered');
  assert.equal(
    emittedHeaders.some((tag) => (attribute(tag, 'class') ?? '').includes('CraftHeader_header')),
    template === 'craft',
    'The emitted customer header belongs to the selected build-time template',
  );
  const classicHeader = elements(first, 'header').some(({ body }) =>
    tags(body, 'button').some((tag) => (attribute(tag, 'class') ?? '').includes('Header_hamburgerMenu')),
  );
  assert.equal(classicHeader, template === 'classic', 'The customer header has the selected template controls');
  const cards = tags(first, 'li').filter((tag) => attribute(tag, 'data-testid') === 'menu-card');
  if (scenario !== 'categories-fail') {
    assert.ok(cards.length > 0, 'Server-rendered cards prove the selected menu surface');
    const marker = template === 'craft' ? 'CraftMenuCard_card' : 'MenuItem_menuItem';
    assert.ok(
      cards.every((tag) => (attribute(tag, 'class') ?? '').includes(marker)),
      'Every emitted card uses the selected template',
    );
  }
}

async function assertSecondPages(origin, scenario, locales) {
  const displayLocales = ['unknown', 'onepage', 'categories-fail'].includes(scenario) ? [] : ['fr', 'en'];
  await Promise.all(
    displayLocales.map(async (locale) => {
      const html = await htmlAt(origin, `/${locale}/menu?page=2`);
      pageContract(html, `/${locale}/menu?page=2`, locale, locales.includes(locale));
      cluster(html, `/${locale}/menu?page=2`, locales.includes(locale) ? locales : []);
      if (!['repeated', 'unknown', 'offers', 'offers-onepage', 'onepage'].includes(scenario)) {
        assert.match(bodyText(html), locale === 'fr' ? /Plat français 205/ : /English dish 201/);
        assert.doesNotMatch(bodyText(html), locale === 'fr' ? /Plat français 1\b/ : /English dish 1\b/);
      }
    }),
  );
}

async function assertOnepage({ first }) {
  assert.match(bodyText(first), /Plat français 205/);
  assert.match(bodyText(first), /Formule française 205/);
}
async function assertBundles({ origin, indexing }) {
  const last = await htmlAt(origin, '/fr/menu?view=bundles&bundlesPage=2');
  pageContract(last, '/fr/menu?view=bundles&bundlesPage=2', 'fr', indexing);
  assert.match(bodyText(last), /Formule française 205/);
  cluster(last, '/fr/menu?view=bundles&bundlesPage=2', indexing ? ['fr', 'en'] : []);
}
async function assertOffersOnepage({ origin, indexing }) {
  const bare = await fetch(`${origin}/fr/menu?categoryId=${CATEGORY_ID}`, { headers, redirect: 'manual' });
  assert.equal(bare.status, 307);
  const bareDestination = new URL(bare.headers.get('location'), origin);
  assert.equal(bareDestination.pathname + bareDestination.search, '/fr/menu');
  const response = await fetch(`${origin}/fr/menu?page=3&categoryId=${CATEGORY_ID}`, { headers, redirect: 'manual' });
  assert.equal(response.status, 307);
  const destination = new URL(response.headers.get('location'), origin);
  assert.equal(destination.pathname + destination.search, '/fr/menu?page=3');
  const combined = await htmlAt(origin, '/fr/menu?page=3');
  pageContract(combined, '/fr/menu?page=3', 'fr', indexing);
  cluster(combined, '/fr/menu?page=3', indexing ? ['fr', 'en'] : []);
  assert.match(bodyText(combined), /Plat français 205/);
}
async function assertOffers({ origin }) {
  assert.match(bodyText(await htmlAt(origin, '/fr/menu?page=3')), /Plat français 205/);
  const path = `/fr/menu?page=3&categoryId=${CATEGORY_ID}`;
  const filtered = await htmlAt(origin, path);
  pageContract(filtered, path, 'fr', false);
  cluster(filtered, path, []);
  assert.match(bodyText(filtered), /Plat français 205/);
  assert.doesNotMatch(bodyText(filtered), /Hors catégorie/);
}
async function assertOverride({ origin, indexing }) {
  const home = await htmlAt(origin, '/fr');
  pageContract(home, '/fr', 'fr', false);
  cluster(home, '/fr', []);
  const english = await htmlAt(origin, '/en');
  pageContract(english, '/en', 'en', indexing);
  cluster(english, '/en', indexing ? ['en'] : []);
  assert.match(bodyText(english), /Authored English welcome/);
}
async function assertComplete({ origin, indexing }) {
  await Promise.all(
    ['fr', 'en', 'tr', 'ar'].map(async (locale) => {
      const home = await htmlAt(origin, `/${locale}`);
      pageContract(home, `/${locale}`, locale, indexing);
      assert.doesNotMatch(bodyText(home), /23:47|11:47 PM/, 'Disabled hours are not advertised as open');
      cluster(home, `/${locale}`, indexing ? ['fr', 'en', 'tr', 'ar'] : []);
      const restaurant = elements(home, 'script')
        .filter(({ tag }) => attribute(tag, 'type') === 'application/ld+json')
        .map(({ body }) => JSON.parse(body))
        .find((schema) => schema['@type'] === 'Restaurant');
      assert.ok(restaurant, 'Restaurant structured data exists');
      assert.equal(restaurant.name, 'Fixture Restaurant');
      assert.equal(restaurant.address.addressLocality, 'Genève');
      assert.equal(restaurant.menu, `${CANONICAL_ORIGIN}/${locale}/menu`);
      assert.equal(restaurant.aggregateRating, undefined);
      assert.equal(restaurant.review, undefined);
      assert.equal(restaurant.telephone, undefined);
      assert.equal(restaurant.openingHoursSpecification, undefined);
      assert.deepEqual(restaurant.geo, { '@type': 'GeoCoordinates', latitude: 46.2, longitude: 6.1 });
    }),
  );
}

const scenarioContracts = {
  onepage: assertOnepage,
  bundles: assertBundles,
  'offers-onepage': assertOffersOnepage,
  offers: assertOffers,
  override: assertOverride,
  complete: assertComplete,
};

function menuLocalesFor(scenario) {
  if (['repeated', 'unknown', 'categories-fail'].includes(scenario)) return [];
  return scenario === 'missing' ? ['fr'] : ['fr', 'en'];
}
function pageCountFor(scenario) {
  if (['offers', 'offers-onepage'].includes(scenario)) return 3;
  return scenario === 'onepage' ? 1 : 2;
}
function normalizedPageFor(scenario) {
  if (['unknown', 'onepage', 'categories-fail'].includes(scenario)) return null;
  return String(pageCountFor(scenario));
}
async function assertCompatibility(origin, scenario, indexing) {
  const alias = await fetch(`${origin}/menu?qr=fixture-qr&tableId=7&junk=discard`, { redirect: 'manual', headers });
  assert.equal(alias.status, 307);
  const location = new URL(alias.headers.get('location'), origin);
  assert.equal(location.origin, origin, 'Compatibility redirect keeps the current host');
  assert.equal(location.pathname, '/en/menu', 'Browser language negotiation prefixes the public compatibility route');
  assert.equal(location.searchParams.get('qr'), 'fixture-qr');
  assert.equal(location.searchParams.get('tableId'), '7');
  assert.equal(location.searchParams.has('junk'), false);
  const normalized = await fetch(`${origin}/fr/menu?page=999`, { headers, redirect: 'manual' });
  assert.equal(normalized.status, 307);
  assert.equal(
    new URL(normalized.headers.get('location'), origin).searchParams.get('page'),
    normalizedPageFor(scenario),
  );
  const privateHtml = await htmlAt(origin, '/fr/cart');
  assert.match(robots(privateHtml), /noindex/);
  const manifestResponse = await fetch(`${origin}/manifest.webmanifest`, { headers });
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.start_url, '/', 'Installed app launch negotiates the visitor locale');
  assert.equal(manifest.scope, '/');
  assert.equal((await fetch(`${origin}/sw.js`, { headers })).status, 200);
  const policy = await (await fetch(`${origin}/robots.txt`, { headers })).text();
  assert.match(policy, indexing ? /Disallow: \/fr\/checkout\// : /Disallow: \/\s/);
  if (indexing) {
    assert.match(policy, /Sitemap: https:\/\/discovery\.fixture\.test\/sitemap\.xml/);
    for (const locale of TENANT_LOCALES) {
      for (const privatePath of [
        `/${locale}/cart$`,
        `/${locale}/cart/`,
        `/${locale}/checkout$`,
        `/${locale}/checkout/`,
      ]) {
        assert.ok(policy.split(/\r?\n/).includes(`Disallow: ${privatePath}`), `${privatePath}: robots disallow`);
      }
    }
    assert.ok(policy.split(/\r?\n/).includes('Allow: /'), 'The crawler policy keeps a public allow control');
    const publicMenu = '/fr/menu';
    const blocksPublicMenu = policy.split(/\r?\n/).some((line) => {
      const rule = line.match(/^Disallow:\s*(\S+)/)?.[1];
      return rule && publicMenu.startsWith(rule);
    });
    assert.equal(blocksPublicMenu, false, 'No more-specific robots rule blocks the public menu');
  }
}

async function assertLocalizedPrivateSeo(origin) {
  const privatePaths = [
    '/cart',
    '/reservations',
    '/checkout/review',
    '/checkout/confirmation?orderId=fixture-order&sessionId=fixture-session',
    '/auth/login',
    '/privacy-policy',
    '/terms-of-usage',
    '/admin/dashboard',
  ];
  for (const locale of TENANT_LOCALES) {
    const path = `/${locale}/cart`;
    const html = await htmlAt(origin, path);
    const document = tags(html, 'html')[0];
    assert.equal(attribute(document, 'lang'), locale, `${path}: server-emitted language`);
    assert.equal(attribute(document, 'dir'), locale === 'ar' ? 'rtl' : 'ltr', `${path}: server-emitted direction`);
    assert.match(robots(html), /noindex/, `${path}: private page remains noindex in the head`);
  }
  for (const locale of ['fr', 'ar']) {
    for (const suffix of privatePaths.filter((path) => path !== '/cart')) {
      const path = `/${locale}${suffix}`;
      const html = await htmlAt(origin, path);
      const document = tags(html, 'html')[0];
      assert.equal(attribute(document, 'lang'), locale, `${path}: server-emitted language`);
      assert.equal(attribute(document, 'dir'), locale === 'ar' ? 'rtl' : 'ltr', `${path}: server-emitted direction`);
      assert.match(robots(html), /noindex/, `${path}: private page remains noindex in the head`);
    }
  }
  const unsupported = await fetch(`${origin}/zz/cart`, { headers, redirect: 'manual' });
  assert.equal(unsupported.status, 404, 'Unknown locale prefixes are rejected instead of served as a locale');
}

export async function assertScenario(origin, scenario, indexing, template) {
  const eligible = indexing && !['repeated', 'unknown', 'categories-fail'].includes(scenario);
  const locales = eligible ? menuLocalesFor(scenario) : [];
  const first = await htmlAt(origin, '/fr/menu');
  pageContract(first, '/fr/menu', 'fr', eligible);
  assertTemplate(first, scenario, template);
  cluster(first, '/fr/menu', locales);
  if (scenario === 'categories-fail') assert.doesNotMatch(bodyText(first), /Plat français 1/);
  else assert.match(bodyText(first), /Plat français 1/);
  assert.doesNotMatch(bodyText(first), /Plat français 206/);
  await assertSecondPages(origin, scenario, locales);
  const arabic = await htmlAt(origin, '/ar/menu');
  pageContract(arabic, '/ar/menu', 'ar', false);
  cluster(arabic, '/ar/menu', []);
  // All ten display-language anchors remain actual server-emitted links, even for unaudited content.
  for (const locale of ['en', 'de', 'tr', 'it', 'ar', 'fr', 'nl', 'es', 'ru', 'zh']) {
    assert.ok(
      tags(first, 'a').some((tag) => attribute(tag, 'href') === `/${locale}/menu`),
      `${locale}: SSR language link`,
    );
  }
  await scenarioContracts[scenario]?.({ origin, indexing, first });
  await assertCompatibility(origin, scenario, indexing);
  if (scenario === 'complete') await assertLocalizedPrivateSeo(origin);
}

function expectedSitemap(scenario, indexing, homeLocales, menuLocales) {
  if (!indexing) return [];
  const expected = homeLocales.map((locale) => `${CANONICAL_ORIGIN}/${locale}`);
  for (const locale of menuLocales) {
    for (let page = 1; page <= pageCountFor(scenario); page++) {
      const suffix = page > 1 ? `?page=${page}` : '';
      expected.push(`${CANONICAL_ORIGIN}/${locale}/menu${suffix}`);
    }
    if (scenario === 'bundles')
      expected.push(
        `${CANONICAL_ORIGIN}/${locale}/menu?view=bundles`,
        `${CANONICAL_ORIGIN}/${locale}/menu?view=bundles&bundlesPage=2`,
      );
  }
  return expected;
}
function assertSitemapEntries(xml, homeLocales, menuLocales) {
  assert.equal(elements(xml, 'lastmod').length, 0, 'No invented freshness');
  for (const { body } of elements(xml, 'url')) {
    const url = new URL(elements(body, 'loc')[0].body.replaceAll('&amp;', '&'));
    const locales = url.pathname.endsWith('/menu') ? menuLocales : homeLocales;
    const tail = url.pathname.replace(/^\/[a-z]+/, '') + url.search;
    const wanted = Object.fromEntries(locales.map((locale) => [locale, `${CANONICAL_ORIGIN}/${locale}${tail}`]));
    if (locales.includes('fr')) wanted['x-default'] = `${CANONICAL_ORIGIN}/fr${tail}`;
    const links = tags(body, 'xhtml:link');
    const emitted = Object.fromEntries(links.map((tag) => [attribute(tag, 'hreflang'), attribute(tag, 'href')]));
    assert.equal(links.length, Object.keys(wanted).length, 'No duplicate sitemap alternatives');
    assert.deepEqual(emitted, wanted, `${url}: sitemap reciprocal cluster`);
  }
}
const alphabetical = (values) => values.toSorted((left, right) => left.localeCompare(right));
async function waitForSitemap(origin, expected, deadline, scenario) {
  const response = await fetch(`${origin}/sitemap.xml`, { headers });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /(?:application|text)\/xml/i);
  const xml = await response.text();
  const actual = elements(xml, 'loc').map(({ body }) => body.replaceAll('&amp;', '&'));
  if (JSON.stringify(alphabetical(actual)) === JSON.stringify(alphabetical(expected))) return xml;
  if (Date.now() >= deadline) {
    assert.deepEqual(alphabetical(actual), alphabetical(expected), `${scenario}: truthful sitemap after ISR`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  return waitForSitemap(origin, expected, deadline, scenario);
}
export async function assertSitemap(origin, scenario, indexing) {
  const homeLocales = scenario === 'override' ? ['en'] : ['fr', 'en', 'tr', 'ar'];
  const menuLocales = menuLocalesFor(scenario);
  const expected = expectedSitemap(scenario, indexing, homeLocales, menuLocales);
  // ISR can start with the build's complete fixture; allow its documented 30s refresh.
  const xml = await waitForSitemap(origin, expected, Date.now() + 45_000, scenario);
  assertSitemapEntries(xml, homeLocales, menuLocales);
}
