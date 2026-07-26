import { test, expect, type Page } from '@playwright/test';
import { expectNoA11yViolations } from '../../helpers/a11y';

/**
 * HIGH-tier — **booking through the map** (FLOOR-PLAN-REVAMP §7 slice S9). The
 * whole revamp exists so a guest can pick a table by looking at the room, so this
 * is the acceptance test for it: the plan renders, a table is chosen *from the
 * plan*, and the booking docket agrees.
 *
 * It also pins the two things §4.2 promises that a unit test cannot reach:
 *
 * - the **List view is a complete alternative** — the same tables, selectable,
 *   on every device. It is the mobile path and the screen-reader path, so "you
 *   can always book without touching the map" has to be true in a real browser;
 * - the **map and the list are one selection**, not two views that drift.
 *
 * Data dependency: the backend's own `FloorPlanSeeder` + metre `TableSeeder`
 * (the 14 × 9 reference plan) own this layout — `e2e/seed/seed.sql` deliberately
 * seeds no reservations tables, because only tables linked to the plan appear
 * here. See the comment at seed.sql §5b.
 *
 * Selectors are role-based (E2E-STRATEGY §Selector strategy). Every table is a
 * `button` whose accessible name comes from `table_marker_aria`
 * ("Table {{number}}, {{seats}} seats, {{status}}").
 */

const TABLE_NAME = /^Table .+ seats/i;

/**
 * A line in the booking panel's "Your Tables" docket. Matched by its own shape
 * ("N seats · Indoor/Outdoor") rather than by a bare table number, which on a
 * page full of dates, times and party sizes would match almost anything.
 */
const docketLines = (page: Page) => page.getByRole('listitem').filter({ hasText: /seats · (Indoor|Outdoor)/i });

/** Wait for the plan payload and the first table to be on screen. */
async function openMap(page: Page) {
  const planResponse = page.waitForResponse(
    (r) => r.url().includes('/api/floorplan') && r.request().method() === 'GET',
    { timeout: 20_000 },
  );
  await page.goto('/reservations');
  await planResponse;
  const map = page.getByRole('group', { name: /floor plan/i });
  await expect(map).toBeVisible({ timeout: 20_000 });
  return map;
}

test('a guest can pick a table from the plan, and the booking docket agrees', async ({ page }) => {
  const map = await openMap(page);

  // The plan is drawn, not an empty box: the seeded reference layout has many
  // tables. One would pass while a broken renderer collapsed them all onto
  // each other, so assert there is a real room's worth.
  const tables = map.getByRole('button', { name: TABLE_NAME });
  expect(await tables.count()).toBeGreaterThan(3);

  // a11y baseline once the map has rendered — this is the surface the revamp
  // rebuilt, so it is the one that has to stay clean.
  await expectNoA11yViolations(page);

  const first = tables.first();
  const label = (await first.getAttribute('aria-label')) ?? '';
  const number = /^Table (\S+),/i.exec(label)?.[1];
  expect(number, `could not read a table number out of "${label}"`).toBeTruthy();

  await first.click();

  // The heading counts the selection, the marker reports itself pressed, and the
  // docket names the table. All three, so a regression that updates one and not
  // the others cannot pass.
  await expect(page.getByRole('heading', { name: /select your table/i })).toContainText('1');
  await expect(map.getByRole('button', { name: TABLE_NAME, pressed: true })).toHaveCount(1);
  await expect(docketLines(page)).toHaveCount(1);
  await expect(docketLines(page).first()).toContainText(number as string);

  // Selecting is a toggle — clicking the same table again lets it go, and the
  // docket empties with it rather than stranding a line nothing points at.
  await first.click();
  await expect(map.getByRole('button', { name: TABLE_NAME, pressed: true })).toHaveCount(0);
  await expect(docketLines(page)).toHaveCount(0);
});

test('the List view is a complete alternative to the map, sharing one selection', async ({ page }) => {
  await openMap(page);

  await page.getByRole('button', { name: /^list$/i }).click();

  // Same tables, as cards with a Select button — the mobile and screen-reader
  // path (§4.2 acceptance criterion 2: bookable without touching the map).
  const selectButtons = page.getByRole('button', { name: /^select$/i });
  expect(await selectButtons.count()).toBeGreaterThan(3);
  await expectNoA11yViolations(page);

  await selectButtons.first().click();
  await expect(page.getByRole('button', { name: /^selected$/i })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: /select your table/i })).toContainText('1');
  await expect(docketLines(page)).toHaveCount(1);

  // Back to the map: the same table is picked there. One selection, two views.
  await page.getByRole('button', { name: /^map$/i }).click();
  const map = page.getByRole('group', { name: /floor plan/i });
  await expect(map.getByRole('button', { name: TABLE_NAME, pressed: true })).toHaveCount(1);
});

test('the map is operable from the keyboard alone', async ({ page }) => {
  const map = await openMap(page);
  const tables = map.getByRole('button', { name: TABLE_NAME });

  // Tables are a roving-tabindex group ordered row-major; arrows move focus and
  // Enter toggles selection (§4.2). Focus the first one directly rather than
  // tabbing the whole page — this test is about the group, not the page order.
  await tables.first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expect(map.getByRole('button', { name: TABLE_NAME, pressed: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: /select your table/i })).toContainText('1');
});
