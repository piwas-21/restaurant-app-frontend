import assert from 'node:assert/strict';

export async function assertAdminNavigationAtWidth(page, menuLink, width) {
  await page.setViewportSize({ width, height: 768 });
  const header = page.locator('header');
  const drawer = header.locator('button[class*="hamburgerMenu"]');
  const language = header.getByRole('button', { name: 'Langue', exact: true });
  const theme = header.getByRole('button', { name: 'Passer en mode sombre', exact: true });
  if (width > 1280) {
    assert.equal(await drawer.isVisible(), false, `Desktop uses its navigation row at ${width}px`);
    assert.equal(await menuLink.isVisible(), true, `Desktop menu remains reachable at ${width}px`);
    assert.equal(await language.isVisible(), true);
    assert.equal(await theme.isVisible(), true);
    return;
  }

  assert.equal(await menuLink.isVisible(), false, `Closed tablet drawer hides navigation at ${width}px`);
  assert.equal(await language.isVisible(), false);
  assert.equal(await theme.isVisible(), false);
  assert.equal(await drawer.getAttribute('aria-expanded'), 'false');
  await header.getByRole('button', { name: 'Menu utilisateur', exact: true }).click();
  const close = header.getByRole('button', { name: 'Fermer le menu', exact: true });
  await menuLink.waitFor({ state: 'visible' });
  assert.equal(await close.getAttribute('aria-expanded'), 'true');
  assert.equal(await language.isVisible(), true, `Tablet language control is reachable at ${width}px`);
  assert.equal(await theme.isVisible(), true, `Tablet theme control is reachable at ${width}px`);
  const user = header.getByRole('button', { name: 'Menu utilisateur', exact: true });
  await user.click();
  await header.getByRole('button', { name: 'Se déconnecter', exact: true }).waitFor({ state: 'visible' });
  await user.click();
  await close.click();
  assert.equal(await drawer.getAttribute('aria-expanded'), 'false');
  assert.equal(await menuLink.isVisible(), false, 'Closing the drawer hides the navigation again');
  assert.equal(await language.isVisible(), false);
}

export async function assertAdminSettingsFitAtWidth(page, width) {
  await page.setViewportSize({ width, height: 768 });
  const tipTab = page.getByRole('button', { name: '💰 Pourboires', exact: true });
  await tipTab.click();
  await page.getByRole('heading', { name: 'Pourboires', exact: true }).waitFor({ state: 'visible' });
  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    overflow: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((element) => ({ className: element.className, right: element.getBoundingClientRect().right })),
  }));
  assert.ok(
    geometry.documentWidth <= geometry.viewportWidth,
    `Admin settings stay within the ${width}px viewport: ${JSON.stringify(geometry)}`,
  );
  const tabBounds = await tipTab.boundingBox();
  assert.ok(tabBounds && tabBounds.x >= 0 && tabBounds.x + tabBounds.width <= width);
}
