import assert from 'node:assert/strict';

export async function assertPublicPageFitsViewport(page, locale, viewportWidth) {
  const layout = await page.evaluate(() => {
    const header = document.querySelector('header')?.getBoundingClientRect();
    return {
      direction: document.documentElement.dir,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      usableWidth: document.documentElement.clientWidth,
      language: document.documentElement.lang,
      viewportWidth: window.innerWidth,
      header: header ? { left: header.left, right: header.right } : null,
    };
  });

  assert.equal(layout.language, locale);
  assert.equal(layout.direction, locale === 'ar' ? 'rtl' : 'ltr');
  assert.equal(layout.viewportWidth, viewportWidth);
  assert.equal(layout.documentWidth, layout.usableWidth, `${locale} public page must not widen the document`);
  assert.ok(
    layout.header && layout.header.left >= 0 && layout.header.right <= layout.usableWidth,
    `${locale} public header stays inside the viewport: ${JSON.stringify(layout.header)}`,
  );
}

export async function assertMenuFitsViewport(page, locale, viewportWidth) {
  // Measure the hydrated menu, after its server cards have been replaced by client data.
  await page.locator('main[data-menu-hydrated="true"] [data-testid="menu-card"]').first().waitFor({ state: 'visible' });
  const layout = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="menu-card"]')).map((card) => {
      const { left, right, width } = card.getBoundingClientRect();
      return { left, right, width };
    });
    return {
      direction: document.documentElement.dir,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      usableWidth: document.documentElement.clientWidth,
      language: document.documentElement.lang,
      viewportWidth: window.innerWidth,
      cards,
    };
  });

  assert.equal(layout.language, locale);
  assert.equal(layout.direction, locale === 'ar' ? 'rtl' : 'ltr');
  assert.equal(layout.viewportWidth, viewportWidth);
  assert.equal(layout.documentWidth, layout.usableWidth, `${locale} menu must not widen the document`);
  assert.ok(layout.cards.length > 0, `${locale} menu has visible cards`);
  assert.ok(
    layout.cards.every((card) => card.width > 0 && card.left >= 0 && card.right <= layout.usableWidth),
    `${locale} menu cards stay inside the viewport: ${JSON.stringify(layout.cards)}`,
  );
}

export async function assertCategoryRailCanScroll(page) {
  const railElement = page.locator('[class*="navScrollContainer"]');
  const rail = await railElement.evaluate((element) => {
    const maxScroll = element.scrollWidth - element.clientWidth;
    const sign = getComputedStyle(element).direction === 'rtl' ? -1 : 1;
    const target = sign * Math.min(maxScroll, 50);
    element.scrollTo({ left: target, behavior: 'instant' });
    return {
      overflowX: getComputedStyle(element).overflowX,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollLeft: element.scrollLeft,
    };
  });

  assert.equal(rail.overflowX, 'auto');
  assert.ok(
    rail.scrollWidth > rail.clientWidth && Math.abs(rail.scrollLeft) > 0,
    `Category navigation scrolls internally: ${JSON.stringify(rail)}`,
  );
}
