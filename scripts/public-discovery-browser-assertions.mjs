import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORY_ID } from './public-discovery-fixture.mjs';
import {
  assertCategoryRailCanScroll,
  assertMenuFitsViewport,
  assertPublicPageFitsViewport,
} from './public-discovery-menu-layout-assertions.mjs';

const isApiRequestPath = (pathname) => /(?:^|\/)api\//.test(pathname);
const LANGUAGE_NAMES = { fr: 'Langue', ar: 'اللغة' };
const CUSTOMER_MENU_TOGGLE_NAMES = {
  en: { open: 'Open menu', close: 'Close menu' },
  tr: { open: 'Menüyü aç', close: 'Menüyü kapat' },
  fr: { open: 'Ouvrir le menu', close: 'Fermer le menu' },
  ar: { open: 'افتح القائمة', close: 'أغلق القائمة' },
};

async function openCustomerNavigation(page, locale) {
  const names = CUSTOMER_MENU_TOGGLE_NAMES[locale];
  assert.ok(names, `Customer navigation labels exist for ${locale}`);
  const openToggle = page.getByRole('button', { name: names.open, exact: true });
  if (await openToggle.isVisible()) {
    await openToggle.click();
    await page.getByRole('button', { name: names.close, exact: true }).waitFor({ state: 'visible' });
  }
}

function assertApiRequestPathControls() {
  assert.equal(isApiRequestPath('/complete/api/Basket'), true, 'Fixture API prefix still matches API requests');
  assert.equal(isApiRequestPath('/apiary/Basket'), false, 'An apiary path is not an API request');
  assert.equal(isApiRequestPath('/_next/static/chunks/app.js'), false, 'Static assets are not API requests');
  const queryOnlyPath = new URL('https://fixture.test/complete/Basket?next=/api/Example').pathname;
  assert.equal(isApiRequestPath(queryOnlyPath), false, 'A query-only API marker is not an API request path');
}

async function openPublicNavigation(page, locale) {
  const menuLink = page.locator('header nav a[href="/fr/menu"]').first();
  if (!(await menuLink.isVisible())) {
    await openCustomerNavigation(page, locale);
    await menuLink.waitFor({ state: 'visible' });
  }
}

async function assertPublicHomeAtViewport(page, origin, locale, width) {
  await page.goto(`${origin}/${locale}`, { waitUntil: 'networkidle' });
  await assertPublicPageFitsViewport(page, locale, width);
}

async function assertPublicMenuAtViewport(page, origin, locale, width) {
  await page.goto(`${origin}/${locale}/menu`, { waitUntil: 'networkidle' });
  await assertMenuFitsViewport(page, locale, width);
}

async function placeLanguageSwitcherAtShellEdge(page, locale) {
  const placed = await page.evaluate((languageName) => {
    const header = document.querySelector('header');
    const shell = header?.firstElementChild;
    const toggle = Array.from(header?.querySelectorAll('button[aria-label]') ?? []).find(
      (button) => button.getAttribute('aria-label') === languageName,
    );
    const switcher = toggle?.parentElement;
    if (!(shell instanceof HTMLElement) || !(switcher instanceof HTMLElement)) return false;

    // The API fixture header is shorter than RUMI's live header. Move the same measured-width
    // switcher to the 1200px shell edge to exercise the production overflow geometry.
    const width = switcher.getBoundingClientRect().width;
    shell.style.position = 'relative';
    switcher.style.position = 'absolute';
    switcher.style.top = '0';
    switcher.style.insetInlineEnd = '0';
    switcher.style.width = `${width}px`;
    return true;
  }, LANGUAGE_NAMES[locale]);

  assert.equal(placed, true, 'The header exposes its public language switcher');
}

async function assertPublicLanguageDropdownAt1281(page, origin, locale) {
  const viewportWidth = 1281;
  await page.setViewportSize({ width: viewportWidth, height: 900 });
  await page.goto(`${origin}/${locale}`, { waitUntil: 'networkidle' });
  const languageName = LANGUAGE_NAMES[locale];
  const toggle = page
    .getByRole('button', { name: languageName, exact: true })
    .and(page.locator('button[aria-expanded]'));
  await toggle.waitFor({ state: 'visible' });
  const panel = page.getByRole('navigation', { name: languageName, exact: true, includeHidden: true });
  await placeLanguageSwitcherAtShellEdge(page, locale);

  async function assertPanelBounds(opened) {
    const layout = await page.evaluate((label) => {
      const element = Array.from(document.querySelectorAll('header nav[aria-label]')).find(
        (candidate) => candidate.getAttribute('aria-label') === label,
      );
      const toggleElement = Array.from(document.querySelectorAll('header button[aria-label]')).find(
        (candidate) => candidate.getAttribute('aria-label') === label && candidate.hasAttribute('aria-expanded'),
      );
      const panelElement = element?.parentElement;
      if (!panelElement || !toggleElement) return null;
      const rect = panelElement.getBoundingClientRect();
      const style = getComputedStyle(panelElement);
      return {
        clientWidth: document.documentElement.clientWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        left: rect.left,
        right: rect.right,
        visibility: style.visibility,
        expanded: toggleElement.getAttribute('aria-expanded'),
        hidden: panelElement.getAttribute('aria-hidden'),
        links: panelElement.querySelectorAll('a[href]').length,
      };
    }, languageName);

    assert.ok(layout, 'The public language panel is present in the initial HTML');
    assert.equal(layout.expanded, String(opened));
    assert.equal(layout.hidden, String(!opened));
    assert.equal(layout.links, 10, 'The language panel retains all ten public language links');
    assert.equal(layout.documentWidth, viewportWidth, `${locale} dropdown does not widen the page`);
    assert.ok(
      layout.left >= 0 && layout.right <= layout.clientWidth,
      `${locale} ${opened ? 'open' : 'closed'} dropdown stays inside the viewport: ${JSON.stringify(layout)}`,
    );
    assert.equal(layout.visibility, opened ? 'visible' : 'hidden');
  }

  await assertPanelBounds(false);
  await assertPublicPageFitsViewport(page, locale, viewportWidth);
  await toggle.click();
  await toggle.waitFor({ state: 'visible' });
  await page.waitForFunction((label) => {
    const button = Array.from(document.querySelectorAll('header button[aria-label]')).find(
      (candidate) => candidate.getAttribute('aria-label') === label && candidate.hasAttribute('aria-expanded'),
    );
    return button?.getAttribute('aria-expanded') === 'true';
  }, languageName);
  await assertPanelBounds(true);
  await toggle.click();
  await page.waitForFunction((label) => {
    const button = Array.from(document.querySelectorAll('header button[aria-label]')).find(
      (candidate) => candidate.getAttribute('aria-label') === label && candidate.hasAttribute('aria-expanded'),
    );
    return button?.getAttribute('aria-expanded') === 'false';
  }, languageName);
  await panel.waitFor({ state: 'attached' });
  await assertPanelBounds(false);
}

async function assertAdminNavigationAtWidth(page, menuLink, width) {
  await page.setViewportSize({ width, height: 768 });
  assert.equal(
    await menuLink.isVisible(),
    true,
    `Admin desktop navigation remains visible at ${width}px without a drawer toggle`,
  );
}

async function openLocaleMenuLink(page, locale) {
  const menuLink = page.locator(`header nav a[href="/${locale}/menu"]`).first();
  if (!(await menuLink.isVisible())) {
    await openCustomerNavigation(page, locale);
    await menuLink.waitFor({ state: 'visible' });
  }
  return menuLink;
}

async function openLocaleHomeLink(page, locale) {
  const homeLink = page.locator(`header nav a[href="/${locale}"]`).first();
  if (!(await homeLink.isVisible())) {
    await openCustomerNavigation(page, locale);
    await homeLink.waitFor({ state: 'visible' });
  }
  return homeLink;
}

async function assertLocaleHomeMenuNavigation(browser, origin, apiOrigin, locale) {
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 820, height: 900 } });
  try {
    await isolateExternal(context, origin, apiOrigin);
    await context.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
    const page = await context.newPage();
    await page.goto(`${origin}/${locale}`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');

    await (await openLocaleMenuLink(page, locale)).click();
    await page.waitForURL((url) => url.pathname === `/${locale}/menu`);
    assert.equal(new URL(page.url()).pathname, `/${locale}/menu`, `${locale} menu navigation retains the URL locale`);
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
    await page.getByTestId('menu-card').first().waitFor({ state: 'visible' });
    assert.match(await page.locator('body').innerText(), /Plat français 1/);

    await (await openLocaleHomeLink(page, locale)).click();
    await page.waitForURL((url) => url.pathname === `/${locale}`);
    assert.equal(new URL(page.url()).pathname, `/${locale}`, `${locale} home navigation retains the URL locale`);
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
  } finally {
    await context.close();
  }
}

async function waitForDocumentLocale(page, locale) {
  await page.waitForFunction(
    ({ language, direction }) =>
      document.documentElement.lang === language && document.documentElement.dir === direction,
    { language: locale, direction: locale === 'ar' ? 'rtl' : 'ltr' },
  );
}

async function assertLocaleRoutingFlows(browser, origin, apiOrigin) {
  assertApiRequestPathControls();
  // Browser negotiation must happen at the server boundary. A stale detector-owned i18next cache
  // is deliberately present so it cannot masquerade as an explicit user preference.
  const detected = await browser.newContext({
    locale: 'tr-TR',
    viewport: { width: 1024, height: 768 },
  });
  try {
    await isolateExternal(detected, origin, apiOrigin);
    await detected.addInitScript(() => localStorage.setItem('i18nextLng', 'fr'));
    const page = await detected.newPage();
    await page.goto(`${origin}/cart?resume=checkout&session_id=cs_fixture#payment-return`, {
      waitUntil: 'networkidle',
    });
    assert.equal(new URL(page.url()).pathname, '/tr/cart', 'Accept-Language prefixes a legacy private route');
    assert.equal(new URL(page.url()).searchParams.get('resume'), 'checkout');
    assert.equal(new URL(page.url()).searchParams.get('session_id'), 'cs_fixture');
    assert.equal(new URL(page.url()).hash, '#payment-return', 'The browser retains the payment return fragment');
    await waitForDocumentLocale(page, 'tr');
    assert.equal(
      (await detected.cookies(origin)).some((cookie) => cookie.name === 'tenant_locale_v1' && cookie.value === 'tr'),
      true,
      'The resolved route preference is persisted separately from the old i18next detector key',
    );
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/tr', 'The PWA/root entry negotiates its supported locale');
    await waitForDocumentLocale(page, 'tr');
  } finally {
    await detected.close();
  }

  // Manual choice persists across a conflicting browser header, reload, and unprefixed legacy entry.
  const manual = await browser.newContext({
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    viewport: { width: 1024, height: 768 },
  });
  try {
    await isolateExternal(manual, origin, apiOrigin);
    const page = await manual.newPage();
    await page.goto(`${origin}/en/cart`, { waitUntil: 'networkidle' });
    await waitForDocumentLocale(page, 'en');
    await openCustomerNavigation(page, 'en');
    const languageToggle = page.getByRole('button', { name: 'Language', exact: true });
    await languageToggle.waitFor({ state: 'visible' });
    await languageToggle.click();
    await page.getByText('French', { exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/fr/cart');
    await waitForDocumentLocale(page, 'fr');
    assert.equal(
      (await manual.cookies(origin)).find((cookie) => cookie.name === 'tenant_locale_v1')?.value,
      'fr',
      'Choosing French stores the explicit locale preference',
    );

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/fr/cart', 'Reload retains the manually selected locale');
    await page.goto(`${origin}/cart?resume=history`, { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/fr/cart', 'The legacy route honors the manual preference');
    assert.equal(new URL(page.url()).searchParams.get('resume'), 'history');
    await page.goto(`${origin}/fr/auth/login`, { waitUntil: 'networkidle' });
    await waitForDocumentLocale(page, 'fr');
    assert.equal(new URL(page.url()).pathname, '/fr/auth/login', 'Authentication entry retains the URL locale');
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/fr/cart', 'Browser history returns to the localized private page');
    await waitForDocumentLocale(page, 'fr');
  } finally {
    await manual.close();
  }

  // Explicit route locale beats both stored preference and browser negotiation, including RTL state.
  const explicit = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1024, height: 768 },
  });
  try {
    await isolateExternal(explicit, origin, apiOrigin);
    await explicit.addCookies([{ name: 'tenant_locale_v1', value: 'fr', url: origin, sameSite: 'Lax' }]);
    const page = await explicit.newPage();
    const apiRequests = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin === apiOrigin && isApiRequestPath(url.pathname)) {
        apiRequests.push({ path: url.pathname, language: request.headers()['accept-language'] ?? '' });
      }
    });
    await page.goto(`${origin}/ar/cart`, { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/ar/cart');
    await waitForDocumentLocale(page, 'ar');
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.ok(apiRequests.length > 0, 'The cart emitted at least one request to the fixture API');
    assert.ok(
      apiRequests.every(({ language }) => /^ar(?:[-,;]|$)/i.test(language.trim())),
      `Every observed API request follows the active Arabic route, not the French cookie: ${JSON.stringify(apiRequests)}`,
    );

    // A Stripe return is a known private path: its order/session/cancel parameters survive the
    // compatibility redirect before the localized confirmation page takes over.
    const response = await explicit.request.get(
      `${origin}/checkout/confirmation?orderId=fixture-order&sessionId=cs_fixture`,
      { maxRedirects: 0 },
    );
    assert.equal(response.status(), 307);
    const paymentReturn = new URL(response.headers().location, origin);
    assert.equal(paymentReturn.pathname, '/ar/checkout/confirmation');
    assert.equal(paymentReturn.searchParams.get('orderId'), 'fixture-order');
    assert.equal(paymentReturn.searchParams.get('sessionId'), 'cs_fixture');
  } finally {
    await explicit.close();
  }

  await assertCookieIndependentLocaleLinks(browser, origin, apiOrigin);
}

async function assertCookieIndependentLocaleLinks(browser, origin, apiOrigin) {
  const context = await browser.newContext({
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    viewport: { width: 1281, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: () => {},
    });
  });
  await isolateExternal(context, origin, apiOrigin);
  try {
    assert.deepEqual(await context.cookies(origin), [], 'The cookie-independent context begins with no cookies');
    const page = await context.newPage();
    const clearCookieState = async () => {
      await context.clearCookies();
      assert.deepEqual(await context.cookies(origin), [], 'No cookie remains before the next navigation');
      assert.equal(await page.evaluate(() => document.cookie), '', 'The document cannot read cookies');
      assert.equal(
        await page.evaluate(() => {
          document.cookie = 'tenant_locale_v1=en; path=/';
          return document.cookie;
        }),
        '',
        'The document cannot write cookies',
      );
      assert.deepEqual(await context.cookies(origin), [], 'A blocked write does not create a browser cookie');
    };

    await page.goto(`${origin}/ar`, { waitUntil: 'networkidle' });
    await waitForDocumentLocale(page, 'ar');
    const consentButton = page.getByRole('button', { name: 'قبول', exact: true });
    if (await consentButton.count()) await consentButton.click();
    await clearCookieState();

    const followLink = async (from, destination, selector) => {
      await page.goto(`${origin}${from}`, { waitUntil: 'networkidle' });
      assert.equal(new URL(page.url()).pathname, from);
      await waitForDocumentLocale(page, 'ar');
      await clearCookieState();
      const link = page.locator(selector).first();
      assert.equal(await link.isVisible(), true, `${from} exposes ${destination}`);
      assert.equal(await link.getAttribute('href'), destination, `${destination} is explicitly locale-qualified`);
      await link.click();
      await page.waitForURL((url) => url.pathname === destination);
      await waitForDocumentLocale(page, 'ar');
      await clearCookieState();
    };

    await followLink('/ar', '/ar/menu', 'header nav a[href="/ar/menu"]');
    await followLink('/ar/menu', '/ar/cart', 'header nav a[href="/ar/cart"]');

    await page.goto(`${origin}/ar`, { waitUntil: 'networkidle' });
    await waitForDocumentLocale(page, 'ar');
    await clearCookieState();
    const reservations = page.locator('a[href="/ar/reservations"]').first();
    if (await reservations.count()) {
      await reservations.click();
      await page.waitForURL((url) => url.pathname === '/ar/reservations');
      await waitForDocumentLocale(page, 'ar');
    } else {
      // This API fixture disables the optional reservations module, so verify its localized route
      // guard remains in Arabic without pretending the disabled navigation link is present.
      await page.goto(`${origin}/ar/reservations`, { waitUntil: 'networkidle' });
      assert.ok(['/ar', '/ar/reservations'].includes(new URL(page.url()).pathname));
      await waitForDocumentLocale(page, 'ar');
    }
    await clearCookieState();

    await followLink('/ar', '/ar/privacy-policy', 'footer a[href="/ar/privacy-policy"]');
    await followLink('/ar', '/ar/terms-of-usage', 'footer a[href="/ar/terms-of-usage"]');

    await page.goto(`${origin}/ar/account`, { waitUntil: 'networkidle' });
    await page.waitForURL((url) => url.pathname === '/ar/auth/login');
    await waitForDocumentLocale(page, 'ar');
  } finally {
    await context.close();
  }
}

export async function browserContract(origin, { root, template, indexing, apiOrigin }) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    await assertLocaleRoutingFlows(browser, origin, apiOrigin);
    await assertLocaleHomeMenuNavigation(browser, origin, apiOrigin, 'fr');
    await assertLocaleHomeMenuNavigation(browser, origin, apiOrigin, 'ar');
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1024, height: 768 } });
    await isolateExternal(context, origin, apiOrigin);
    await context.addInitScript(() => {
      if (!localStorage.getItem('i18nextLng')) localStorage.setItem('i18nextLng', 'en');
    });
    const page = await context.newPage();
    const qrValidations = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/Tables/validate-qr/')) qrValidations.push(request.url());
    });
    const hydrationErrors = [];
    page.on('console', (message) => {
      if (/hydration|Minified React error #418|Text content does not match/i.test(message.text()))
        hydrationErrors.push(message.text());
    });
    await page.goto(`${origin}/fr`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    assert.ok(await page.locator('header').count(), 'The customer header remains visible after hydration');
    const translatedMenuToggle = page.getByRole('button', { name: 'Ouvrir le menu', exact: true });
    assert.equal(await translatedMenuToggle.isVisible(), true, 'Both customer templates expose a named menu toggle');
    await openPublicNavigation(page, 'fr');
    await page.locator('header nav a[href="/fr/menu"]').first().click();
    await page.waitForURL('**/fr/menu');
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    await page.getByText('Plat français 1', { exact: true }).first().waitFor();
    await page.getByTestId('menu-card').first().waitFor({ state: 'visible' });
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
    await assertPublicHomeAtViewport(page, origin, 'fr', 820);
    await assertPublicHomeAtViewport(page, origin, 'ar', 820);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${origin}/fr`, { waitUntil: 'networkidle' });
    await assertPublicPageFitsViewport(page, 'fr', 1280);
    const exactBreakpointMenu = page.locator('header nav a[href="/fr/menu"]').first();
    const exactBreakpointToggle = page.getByRole('button', { name: 'Ouvrir le menu', exact: true });
    assert.equal(await exactBreakpointMenu.isVisible(), false, 'At 1280px public navigation starts collapsed');
    assert.equal(await exactBreakpointToggle.isVisible(), true, 'At 1280px the public drawer toggle is visible');
    await page.addStyleTag({ path: path.join(root, 'e2e/screenshots/screenshot.css') });
    const fullPageHome = await page.screenshot({ fullPage: true });
    assert.equal(
      fullPageHome.readUInt32BE(16),
      1280,
      'The exact-breakpoint home full-page capture stays at the viewport width',
    );
    await exactBreakpointToggle.click();
    assert.equal(await exactBreakpointMenu.isVisible(), true, 'The exact-breakpoint drawer exposes public links');
    await exactBreakpointMenu.click();
    await page.waitForURL('**/fr/menu');
    await assertMenuFitsViewport(page, 'fr', 1280);
    await page.setViewportSize({ width: 1281, height: 900 });
    await page.goto(`${origin}/fr/menu`, { waitUntil: 'networkidle' });
    await assertMenuFitsViewport(page, 'fr', 1281);
    assert.equal(await page.locator('header nav a[href="/fr/menu"]').first().isVisible(), true);
    assert.equal(await exactBreakpointToggle.isVisible(), false);
    await assertPublicLanguageDropdownAt1281(page, origin, 'fr');
    await assertPublicLanguageDropdownAt1281(page, origin, 'ar');
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertPublicMenuAtViewport(page, origin, 'fr', 820);
    await assertPublicMenuAtViewport(page, origin, 'ar', 820);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/ar/menu`, { waitUntil: 'networkidle' });
    await assertCategoryRailCanScroll(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${origin}/ar/menu`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ar');
    await page.goto(`${origin}/cart`, { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/ar/cart', 'Legacy cart navigation retains the active locale');
    await waitForDocumentLocale(page, 'ar');
    await page.goto(`${origin}/scan?qr=fixture-qr`);
    await page.waitForURL((url) => url.pathname === '/ar/menu', { timeout: 20_000 });
    assert.equal(new URL(page.url()).pathname, '/ar/menu', 'QR handoff stays in its locale');
    await page.getByText('Plat français 1', { exact: true }).first().waitFor();
    await page.waitForFunction((tableId) => {
      try {
        return JSON.parse(sessionStorage.getItem('rumi_table_context') || '{}').tableId === tableId;
      } catch {
        return false;
      }
    }, CATEGORY_ID);
    await page.getByRole('status').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(1_250);
    assert.equal(
      qrValidations.filter((url) => url.endsWith('/api/Tables/validate-qr/fixture-qr')).length,
      1,
      'One QR scan validates once even as its table context updates',
    );
    assert.equal(
      await page.evaluate(() => JSON.parse(sessionStorage.getItem('rumi_table_context') || '{}').tableId),
      CATEGORY_ID,
    );
    await page.goto(`${origin}/scan?qr=fixture-qr-next`);
    await page.waitForURL((url) => url.pathname === '/ar/menu', { timeout: 20_000 });
    await page.getByRole('status').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(1_250);
    assert.equal(
      qrValidations.filter((url) => url.endsWith('/api/Tables/validate-qr/fixture-qr-next')).length,
      1,
      'A changed QR token still validates on a later scan',
    );
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

    const adminContext = await browser.newContext({ locale: 'en-US', viewport: { width: 1024, height: 768 } });
    await isolateExternal(adminContext, origin, apiOrigin);
    await adminContext.addInitScript(() => {
      localStorage.setItem(
        'user',
        JSON.stringify({
          firstName: 'Fixture',
          lastName: 'Admin',
          email: 'admin@example.invalid',
          role: 'Admin',
          accessToken: 'fixture-token',
        }),
      );
      localStorage.setItem('auth_token', 'fixture-token');
      localStorage.setItem('refresh_token', 'fixture-refresh-token');
    });
    const adminPage = await adminContext.newPage();
    await adminPage.route('**/api/Auth/refresh-token', (route) => route.fulfill({ status: 503, body: '' }));
    await adminPage.goto(`${origin}/fr/admin/dashboard`, { waitUntil: 'networkidle' });
    const adminMenuLink = adminPage.locator('header nav a[href="/fr/menu"]');
    await adminMenuLink.waitFor({ state: 'visible' });
    assert.equal(
      await adminPage.locator('header').getByRole('button', { name: 'Ouvrir le menu', exact: true }).count(),
      0,
    );
    await assertAdminNavigationAtWidth(adminPage, adminMenuLink, 1024);
    await assertAdminNavigationAtWidth(adminPage, adminMenuLink, 1280);
    await adminContext.close();
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
