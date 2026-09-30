import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORY_ID } from './public-discovery-fixture.mjs';
import {
  assertCategoryRailCanScroll,
  assertMenuFitsViewport,
  assertPublicPageFitsViewport,
} from './public-discovery-menu-layout-assertions.mjs';

async function openPublicNavigation(page) {
  const menuLink = page.locator('header nav a[href="/menu"], header nav a[href="/fr/menu"]').first();
  if (await menuLink.isVisible()) return menuLink;

  const hamburger = page.locator('header button[class*="hamburger"]');
  assert.equal(await hamburger.count(), 1, 'Responsive customer header exposes its navigation toggle');
  await hamburger.click();
  await menuLink.waitFor({ state: 'visible' });
  return menuLink;
}

export async function browserContract(origin, { root, template, indexing, apiOrigin }) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1024, height: 768 } });
    await isolateExternal(context, origin, apiOrigin);
    await context.addInitScript(() => {
      if (!localStorage.getItem('i18nextLng')) localStorage.setItem('i18nextLng', 'en');
    });
    const page = await context.newPage();
    const hydrationErrors = [];
    page.on('console', (message) => {
      if (/hydration|Minified React error #418|Text content does not match/i.test(message.text()))
        hydrationErrors.push(message.text());
    });
    await page.goto(`${origin}/fr`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    assert.ok(await page.locator('header').count(), 'The customer header remains visible after hydration');
    assert.equal(await page.locator('header[class*="CraftHeader_header"]').count(), template === 'craft' ? 1 : 0);
    assert.equal(
      await page.locator('header button[class*="Header_hamburgerMenu"]').count(),
      template === 'classic' ? 1 : 0,
    );
    await (await openPublicNavigation(page)).click();
    await page.waitForURL('**/fr/menu');
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    await page.getByText('Plat français 1', { exact: true }).first().waitFor();
    assert.match(
      await page.getByTestId('menu-card').first().getAttribute('class'),
      template === 'craft' ? /CraftMenuCard_card/ : /MenuItem_menuItem/,
    );
    assert.match(await page.locator('body').innerText(), /Plat français 1/);
    const secondPage = page.locator('a[href="/fr/menu?page=2"]').first();
    await secondPage.click();
    await page.waitForURL('**/fr/menu?page=2');
    await page.getByText('Plat français 205', { exact: true }).first().waitFor();
    await page.goBack();
    await page.waitForURL('**/fr/menu');
    await page.getByText('Plat français 1', { exact: true }).first().waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(), /Plat français 205/);
    await page.setViewportSize({ width: 820, height: 1180 });
    for (const locale of ['fr', 'ar']) {
      await page.goto(`${origin}/${locale}`, { waitUntil: 'networkidle' });
      await assertPublicPageFitsViewport(page, locale, 820);
    }
    await page.setViewportSize({ width: 1281, height: 900 });
    await page.goto(`${origin}/fr/menu`, { waitUntil: 'networkidle' });
    await assertMenuFitsViewport(page, 'fr', 1281);
    assert.equal(await page.locator('header nav a[href="/menu"]').first().isVisible(), true);
    assert.equal(
      await page.locator('header button[class*="hamburger"]').evaluate((button) => getComputedStyle(button).display),
      'none',
      'Desktop navigation remains visible just above the tablet collapse breakpoint',
    );
    await page.setViewportSize({ width: 820, height: 1180 });
    for (const locale of ['fr', 'ar']) {
      await page.goto(`${origin}/${locale}/menu`, { waitUntil: 'networkidle' });
      await assertMenuFitsViewport(page, locale, 820);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/ar/menu`, { waitUntil: 'networkidle' });
    await assertCategoryRailCanScroll(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${origin}/ar/menu`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ar');
    await page.goto(`${origin}/cart`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.lang === 'ar');
    await page.goto(`${origin}/scan?qr=fixture-qr`);
    await page.waitForURL('**/fr/menu', { timeout: 20_000 });
    await page.getByText('Plat français 1', { exact: true }).first().waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(
      await page.evaluate(() => JSON.parse(sessionStorage.getItem('rumi_table_context') || '{}').tableId),
      CATEGORY_ID,
    );
    const artifacts = path.join(root, 'test-results', 'public-discovery');
    await mkdir(artifacts, { recursive: true });
    await page.screenshot({
      path: path.join(artifacts, `${template}-${indexing ? 'indexed' : 'noindex'}-menu.png`),
      fullPage: false,
    });
    assert.deepEqual(hydrationErrors, [], 'Public first paint hydrates without language/text mismatches');
    await context.close();
  } finally {
    await browser.close();
  }
}

export async function edgeBrowserContract(origin, scenario, api) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  if (scenario === 'categories-fail') api.setCompleteLayout('onepage');
  if (['offers', 'offers-onepage'].includes(scenario)) api.setCompletePresentation('categoryOffers');
  if (scenario === 'offers-onepage') api.setCompleteLayout('onepage');
  if (scenario === 'override') api.setLandingFailure(true);
  const firstCall = api.calls.length;
  try {
    const page = await browser.newPage({ locale: 'en-US' });
    await isolateExternal(page.context(), origin, api.origin);
    const catalogDelay = scenario === 'offers' ? await delayFilteredCatalog(page, api.origin) : undefined;
    await page.goto(`${origin}/${scenario === 'override' ? 'en' : 'fr/menu'}`, { waitUntil: 'networkidle' });
    if (scenario === 'override') {
      assert.match(await page.locator('body').innerText(), /Authored English welcome/);
      assert.ok(
        api.calls
          .slice(firstCall)
          .some((call) => call.scenario === 'complete' && call.path === '/api/restaurant-info/landing'),
        'Failed client landing refresh was attempted',
      );
    } else if (scenario === 'categories-fail') {
      await page.getByText('Plat français 205', { exact: true }).first().waitFor();
      assert.match(await page.locator('body').innerText(), /Plats de la maison/);
    } else if (scenario === 'offers-onepage') {
      await page.goto(`${origin}/fr/menu?page=3&categoryId=${CATEGORY_ID}`, { waitUntil: 'networkidle' });
      assert.equal(new URL(page.url()).searchParams.has('categoryId'), false);
      await page.getByText('Plat français 205', { exact: true }).first().waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByText('Plat français 205', { exact: true }).first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get('page'), '3');
    } else {
      await page.locator('a[href="/fr/menu?page=3"]').first().click();
      await page.waitForURL('**/fr/menu?page=3');
      await page.getByText('Plat français 205', { exact: true }).first().waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByText('Plat français 205', { exact: true }).first().waitFor();
      assert.match(
        await page.locator('body').innerText(),
        /Hors catégorie/,
        'Unfiltered tail includes the known uncategorized offer',
      );
      await page.goBack();
      await page.waitForURL('**/fr/menu');
      await page.getByText('Plat français 1', { exact: true }).first().waitFor();
      await page.getByRole('button', { name: 'Plats de la maison', exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get('categoryId') === CATEGORY_ID);
      await page.locator('a').filter({ hasText: /^3$/ }).first().click();
      await page.waitForURL(
        (url) => url.searchParams.get('categoryId') === CATEGORY_ID && url.searchParams.get('page') === '3',
      );
      await page.getByText('Plat français 205', { exact: true }).first().waitFor();
      await assertFilteredOffers(page, api, firstCall);
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByText('Plat français 205', { exact: true }).first().waitFor();
      assert.equal(
        await page.getByRole('button', { name: 'Plats de la maison', exact: true }).getAttribute('aria-pressed'),
        'true',
      );
      await page.goBack();
      await page.waitForURL(
        (url) => url.searchParams.get('categoryId') === CATEGORY_ID && !url.searchParams.has('page'),
      );
      await page.getByText('Plat français 1', { exact: true }).first().waitFor();
    }
    catalogDelay?.assertExercised();
  } finally {
    api.setCompleteLayout('tabs');
    api.setCompletePresentation('legacySeparate');
    api.setLandingFailure(false);
    await browser.close();
  }
}

// Only the fixture API and production app participate in this contract; embedded maps/OAuth
// services have their own release checks and must not keep a deterministic browser run busy.
async function isolateExternal(context, origin, apiOrigin) {
  await context.route('**/*', (route) => {
    const target = new URL(route.request().url());
    return !['http:', 'https:'].includes(target.protocol) || [origin, apiOrigin].includes(target.origin)
      ? route.continue()
      : route.abort();
  });
}

// Exercise a slow category response so a stale All-page tail cannot satisfy the navigation wait.
async function delayFilteredCatalog(page, apiOrigin) {
  let delayedResponses = 0;
  await page.route('**/api/Catalog?**', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === apiOrigin && url.searchParams.get('page') === '3' && url.searchParams.has('categoryId')) {
      delayedResponses++;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (!page.isClosed()) await route.fallback();
  });
  return {
    assertExercised: () => assert.ok(delayedResponses > 0, 'Slow filtered catalogue response actually exercised'),
  };
}

async function assertFilteredOffers(page, api, firstCall) {
  const { expect } = await import('@playwright/test');
  // The old All page can remain during a React transition; observe the actual filter and card state.
  const category = page.getByRole('button', { name: 'Plats de la maison', exact: true });
  try {
    await page.waitForLoadState('networkidle');
    await expect(category).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Hors catégorie', { exact: true })).toHaveCount(0);
    assert.doesNotMatch(await page.locator('body').innerText(), /Hors catégorie/);
  } catch (error) {
    const evidence = {
      url: page.url(),
      selectedCategory: await category
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-pressed')))
        .catch(() => ['unavailable']),
      catalogRequests: api.calls.slice(firstCall).filter((call) => call.path === '/api/Catalog'),
    };
    throw new Error(`Filtered offer state did not settle: ${JSON.stringify(evidence)}`, { cause: error });
  }
}
