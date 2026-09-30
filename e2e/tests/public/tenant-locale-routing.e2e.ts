import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { apiBaseUrl } from '../../helpers/config';

const localeCookie = 'tenant_locale_v1';
const apiBase = new URL(apiBaseUrl());
const apiPathPrefix = `${apiBase.pathname.replace(/\/+$/, '')}/api/`;

function isApiRequest(url: URL): boolean {
  return url.origin === apiBase.origin && url.pathname.startsWith(apiPathPrefix);
}

function assertApiRequestMatcherControls(): void {
  const basePath = apiBase.pathname.replace(/\/+$/, '');
  expect(isApiRequest(new URL(`${basePath}/api/Basket`, apiBase.origin))).toBe(true);
  expect(isApiRequest(new URL(`${basePath}/apiary/Basket`, apiBase.origin))).toBe(false);
  expect(isApiRequest(new URL('/_next/static/chunks/app.js', apiBase.origin))).toBe(false);
  expect(isApiRequest(new URL(`${basePath}/Basket?next=/api/Example`, apiBase.origin))).toBe(false);
}

function appUrl(baseURL: string | undefined, path: string): string {
  return new URL(path, baseURL ?? 'http://localhost:3000').toString();
}

async function expectDocumentLocale(page: import('@playwright/test').Page, locale: string): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
}

test('browser detection prefixes a legacy route and ignores the stale French i18next cache', async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:3000';
  const context = await browser.newContext({
    locale: 'tr-TR',
  });
  try {
    await context.addInitScript(() => localStorage.setItem('i18nextLng', 'fr'));
    const page = await context.newPage();
    await page.goto(appUrl(baseURL, '/cart?source=legacy-cache#resume'));
    await expect(page).toHaveURL(/\/tr\/cart\?source=legacy-cache#resume$/);
    await expectDocumentLocale(page, 'tr');
    await expectNoA11yViolations(page);
    expect(
      (await context.cookies(origin)).find((cookie) => cookie.name === localeCookie)?.value,
      'The route locale is persisted in its dedicated preference cookie',
    ).toBe('tr');
  } finally {
    await context.close();
  }
});

test('manual choice persists through cookies, reload, browser history, and legacy entry URLs', async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:3000';
  const context = await browser.newContext({
    locale: 'en-US',
  });
  try {
    const page = await context.newPage();
    await page.goto(appUrl(baseURL, '/en/cart'));
    await expectDocumentLocale(page, 'en');
    await expectNoA11yViolations(page);
    const navigationToggle = page.getByRole('button', { name: 'Open menu', exact: true });
    if (await navigationToggle.isVisible()) await navigationToggle.click();
    await page.getByRole('button', { name: 'Language', exact: true }).click();
    await page.getByText('French', { exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/fr/cart');
    await expectDocumentLocale(page, 'fr');
    await expectNoA11yViolations(page);
    expect((await context.cookies(origin)).find((cookie) => cookie.name === localeCookie)?.value).toBe('fr');

    await page.reload();
    await expect(page).toHaveURL(/\/fr\/cart$/);
    await expectDocumentLocale(page, 'fr');
    await page.goto(appUrl(baseURL, '/cart?source=legacy-entry'));
    await expect(page).toHaveURL(/\/fr\/cart\?source=legacy-entry$/);

    await page.goto(appUrl(baseURL, '/fr/auth/login'));
    await expect(page).toHaveURL(/\/fr\/auth\/login$/);
    await expectDocumentLocale(page, 'fr');
    await page.goBack();
    await expect(page).toHaveURL(/\/fr\/cart\?source=legacy-entry$/);
    await expectDocumentLocale(page, 'fr');
  } finally {
    await context.close();
  }
});

test('explicit Arabic routes override a French cookie and preserve payment return parameters', async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:3000';
  const context = await browser.newContext({ locale: 'en-US' });
  try {
    assertApiRequestMatcherControls();
    await context.addCookies([{ name: localeCookie, value: 'fr', url: origin, sameSite: 'Lax' }]);
    const page = await context.newPage();
    const apiLanguageHeaders: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (isApiRequest(url)) apiLanguageHeaders.push(request.headers()['accept-language'] ?? '');
    });
    await page.goto(appUrl(baseURL, '/ar/cart'), { waitUntil: 'networkidle' });
    await expectDocumentLocale(page, 'ar');
    await expectNoA11yViolations(page);
    expect(
      apiLanguageHeaders.length,
      'The cart emitted requests to the configured API origin and path prefix',
    ).toBeGreaterThan(0);
    expect(
      apiLanguageHeaders.every((header) => /^ar(?:[-,;]|$)/i.test(header.trim())),
      'Every API request uses the active route locale even when a different preference cookie exists',
    ).toBe(true);

    await page.goto(appUrl(baseURL, '/ar/auth/login'));
    await expect(page).toHaveURL(/\/ar\/auth\/login$/);
    await expectDocumentLocale(page, 'ar');
    await expectNoA11yViolations(page);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();

    const response = await context.request.get(
      appUrl(baseURL, '/checkout/confirmation?orderId=fixture-order&sessionId=cs_fixture'),
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(307);
    const destination = new URL(response.headers().location, origin);
    expect(destination.pathname).toBe('/ar/checkout/confirmation');
    expect(destination.searchParams.get('orderId')).toBe('fixture-order');
    expect(destination.searchParams.get('sessionId')).toBe('cs_fixture');
  } finally {
    await context.close();
  }
});

test('unknown locale segments return 404 and blocked browser storage does not break an explicit route', async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:3000';
  const context = await browser.newContext({ locale: 'en-US' });
  try {
    const unknown = await context.request.get(appUrl(baseURL, '/zz/cart'), { maxRedirects: 0 });
    expect(unknown.status()).toBe(404);
  } finally {
    await context.close();
  }

  const storageBlocked = await browser.newContext({ locale: 'en-US' });
  try {
    await storageBlocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Browser storage is unavailable', 'SecurityError');
        },
      });
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => '',
        // Block persistence while keeping reads empty for the explicit-route check.
        set: () => {},
      });
    });
    const page = await storageBlocked.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    expect(await storageBlocked.cookies(origin)).toEqual([]);
    await page.goto(appUrl(origin, '/fr/auth/login'));
    await expectDocumentLocale(page, 'fr');
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expectNoA11yViolations(page);
    expect(await page.evaluate(() => document.cookie)).toBe('');
    expect(await storageBlocked.cookies(origin)).toEqual([]);
    expect(pageErrors, 'Storage restrictions do not crash route locale hydration').toEqual([]);
  } finally {
    await storageBlocked.close();
  }
});

test('explicit Arabic customer links keep their locale when cookie storage is unavailable', async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:3000';
  const context = await browser.newContext({
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      // Block persistence while keeping reads empty for the explicit-route check.
      set: () => {},
    });
  });

  try {
    expect(await context.cookies(origin), 'A fresh browser starts without preference cookies').toEqual([]);
    const page = await context.newPage();
    const clearCookieState = async () => {
      await context.clearCookies();
      expect(await context.cookies(origin), 'No server cookie can rescue a bare client link').toEqual([]);
      expect(await page.evaluate(() => document.cookie), 'Page scripts cannot read cookies').toBe('');
      expect(
        await page.evaluate(() => {
          document.cookie = 'tenant_locale_v1=en; path=/';
          return document.cookie;
        }),
        'Page scripts cannot write a locale preference cookie',
      ).toBe('');
      expect(await context.cookies(origin)).toEqual([]);
    };

    await page.goto(appUrl(baseURL, '/ar'));
    await expectDocumentLocale(page, 'ar');
    await expectNoA11yViolations(page);
    const consentButton = page.getByRole('button', { name: 'قبول', exact: true });
    if (await consentButton.count()) await consentButton.click();
    await clearCookieState();

    const followLink = async (from: string, destination: string, accessibleName: string) => {
      await page.goto(appUrl(baseURL, from));
      await expectDocumentLocale(page, 'ar');
      await clearCookieState();
      const navigationToggle = page.getByRole('button', { name: 'افتح القائمة', exact: true });
      await expect(navigationToggle).toBeVisible();
      await navigationToggle.click();
      const link = page.getByRole('link', { name: accessibleName, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', destination);
      await link.click();
      await page.waitForURL((url) => url.pathname === destination);
      await expectDocumentLocale(page, 'ar');
      await clearCookieState();
    };

    await followLink('/ar', '/ar/menu', 'القائمة');
    await followLink('/ar/menu', '/ar/cart', 'العربة');

    await page.goto(appUrl(baseURL, '/ar'));
    await expectDocumentLocale(page, 'ar');
    await clearCookieState();
    const navigationToggle = page.getByRole('button', { name: 'افتح القائمة', exact: true });
    await expect(navigationToggle).toBeVisible();
    await navigationToggle.click();
    const reservationLink = page.getByRole('link', { name: 'الحجوزات', exact: true });
    if (await reservationLink.count()) {
      await expect(reservationLink).toBeVisible();
      await reservationLink.click();
      await page.waitForURL((url) => url.pathname === '/ar/reservations');
      await expectDocumentLocale(page, 'ar');
    } else {
      // Reservations can be disabled for a tenant. Still verify the localized route's
      // module guard keeps its fallback within the explicit Arabic route tree.
      await page.goto(appUrl(baseURL, '/ar/reservations'));
      await expect(page).toHaveURL((url) => url.pathname === '/ar' || url.pathname.startsWith('/ar/'));
      await expectDocumentLocale(page, 'ar');
    }
    await clearCookieState();

    await followLink('/ar', '/ar/privacy-policy', 'footer a[href="/ar/privacy-policy"]');
    await followLink('/ar', '/ar/terms-of-usage', 'footer a[href="/ar/terms-of-usage"]');

    await page.goto(appUrl(baseURL, '/ar/account'));
    await expect(page).toHaveURL((url) => url.pathname === '/ar/auth/login');
    await expectDocumentLocale(page, 'ar');
  } finally {
    await context.close();
  }
});

test('QR entry stays localized and private pages keep noindex metadata', async ({ browser, baseURL }) => {
  const origin = baseURL ?? 'http://localhost:3000';
  const context = await browser.newContext({ locale: 'en-US' });
  try {
    await context.addCookies([{ name: localeCookie, value: 'ar', url: origin, sameSite: 'Lax' }]);
    const page = await context.newPage();
    await page.goto(appUrl(baseURL, '/scan?qr=locale-flow-invalid'));
    await expect(page).toHaveURL(/\/ar\/scan\?qr=locale-flow-invalid$/);
    await expectDocumentLocale(page, 'ar');
    await expectNoA11yViolations(page);

    for (const path of ['/fr/cart', '/fr/privacy-policy', '/fr/terms-of-usage']) {
      await page.goto(appUrl(baseURL, path));
      await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
      await expectDocumentLocale(page, 'fr');
      await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    }
  } finally {
    await context.close();
  }
});
