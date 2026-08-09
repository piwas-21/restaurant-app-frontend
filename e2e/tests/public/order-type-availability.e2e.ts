import { test, expect, type Page } from '@playwright/test';
import {
  CHANNEL_LABEL,
  channelList,
  enabledChannels,
  findBlockedFixture,
  findUnrestrictedProduct,
  seedChannel,
  type BlockedFixture,
} from '../../helpers/orderTypeAvailability';

/**
 * HIGH-tier — per-order-type availability on the customer menu
 * (ORDER-TYPE-AVAILABILITY-PLAN §4.4, slices S4 + §9.10).
 *
 * The promise this pins: a guest whose chosen channel cannot order an item is TOLD SO on the card,
 * given one tap out, and cannot reach an add by any route. Before S4 they saw nothing until the
 * server refused the add in untranslated English.
 *
 * Every fixture is DISCOVERED from the API (see `helpers/orderTypeAvailability.ts`), so this one
 * spec runs against a seeded local backend in CI and against the deployed classic (staging) and
 * craft (demo) environments, whose catalog and enabled-channel config differ. Scenarios an
 * environment cannot demonstrate skip with a stated reason rather than failing.
 *
 * Remote run:
 *   E2E_REMOTE=1 E2E_BASE_URL=https://staging.fooderist.com \
 *   E2E_API_BASE_URL=https://staging.fooderist.com npx playwright test order-type-availability
 */

/** The card is a list item whose accessible name starts with the product name. */
function card(page: Page, productName: string) {
  return page.getByRole('listitem').filter({ hasText: productName }).first();
}

async function gotoMenu(page: Page) {
  await page.goto('/menu');
  // The grid is what every assertion reads; waiting on it avoids racing the products fetch.
  await expect(page.getByRole('list').first()).toBeVisible({ timeout: 30_000 });
}

let fixture: BlockedFixture | null = null;
let enabled: string[] = [];

test.beforeAll(async ({ request }) => {
  enabled = await enabledChannels(request);
  fixture = await findBlockedFixture(request);
});

test.describe('no channel chosen — the dominant browse state', () => {
  test('a restricted item is CHIPPED but never dimmed, and stays addable', async ({ page }) => {
    test.skip(!fixture, 'no product is blocked on any enabled channel in this environment');
    const f = fixture as BlockedFixture;
    test.skip(f.orderableOn.length === 0, 'item has no enabled channel at all — covered by its own case');

    await seedChannel(page, null);
    await gotoMenu(page);

    const item = card(page, f.product.name);
    await expect(item).toBeVisible();
    // The chip states where it CAN be ordered…
    await expect(item.getByText(`${channelList(f.orderableOn)} only`)).toBeVisible();
    // …and that is all: no way out is offered, because nothing is blocked yet.
    await expect(item.getByRole('button', { name: /^Switch to / })).toHaveCount(0);
    // Crucially still addable — §2 fixes that nothing dims before a channel is picked.
    await expect(item.getByRole('button', { name: `Add ${f.product.name} to order` })).toBeVisible();
  });

  test('an unrestricted item says nothing at all', async ({ page, request }) => {
    const plain = await findUnrestrictedProduct(request);
    test.skip(!plain, 'every product in this environment carries a restriction');

    await seedChannel(page, null);
    await gotoMenu(page);

    const item = card(page, plain!.name);
    await expect(item).toBeVisible();
    await expect(item.getByText(/ only$/)).toHaveCount(0);
    await expect(item.getByRole('button', { name: `Add ${plain!.name} to order` })).toBeVisible();
  });
});

test.describe('a channel is chosen', () => {
  test('an item the channel CAN order is not chipped — a notice there would be noise', async ({ page }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;
    test.skip(f.orderableOn.length === 0, 'no enabled channel can order this item');

    await seedChannel(page, f.orderableOn[0]);
    await gotoMenu(page);

    const item = card(page, f.product.name);
    await expect(item).toBeVisible();
    await expect(item.getByText(/ only$/)).toHaveCount(0);
    await expect(item.getByRole('button', { name: `Add ${f.product.name} to order` })).toBeVisible();
  });

  test('a BLOCKED item states the reason, drops Add, and keeps Details reachable', async ({ page }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;

    await seedChannel(page, f.blockedOn);
    await gotoMenu(page);

    const item = card(page, f.product.name);
    await expect(item).toBeVisible();
    // TWO nodes carry the reason on a blocked card, by design: the diagonal corner ribbon — the
    // marker a guest reads at a glance across a grid, where the recede alone says "something is off
    // about this dish" without saying what — and the sentence above the switch link. Counting both
    // rather than asserting one: `toBeVisible()` on a single match went red the day the ribbon
    // landed, which reads as "the reason disappeared" when the truth is the opposite.
    await expect(item.getByText(f.expectedChipText)).toHaveCount(2);

    // Add is REMOVED, not disabled — a disabled control fires no click and explains nothing (#208).
    await expect(item.getByRole('button', { name: `Add ${f.product.name} to order` })).toHaveCount(0);
    // …but the guest can still read the item.
    await expect(item.getByRole('button', { name: 'Details' })).toBeVisible();
  });

  test('the reason is part of the card ACCESSIBLE NAME, not just pixels', async ({ page }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;

    await seedChannel(page, f.blockedOn);
    await gotoMenu(page);

    // `aria-labelledby` folds the reason id in, so a screen reader hears the dim's cause. This is
    // what replaced the `aria-disabled` §4.4 asked for — a list item is not an interactive role.
    await expect(card(page, f.product.name)).toHaveAccessibleName(new RegExp(escape(f.expectedChipText)));
  });

  test('one tap on Switch-to-X unblocks the card', async ({ page }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;
    test.skip(f.orderableOn.length === 0, 'nothing to switch TO — every allowed channel is disabled');

    await seedChannel(page, f.blockedOn);
    await gotoMenu(page);

    const item = card(page, f.product.name);
    const target = f.orderableOn[0];
    await item.getByRole('button', { name: `Switch to ${CHANNEL_LABEL[target]}` }).click();

    // Committing the channel refetches the grid, and the item comes back orderable. Takeaway may
    // raise its contact modal first (guest with no details on file) — dismiss it if so.
    const modal = page.getByRole('dialog');
    if (await modal.isVisible().catch(() => false)) await page.keyboard.press('Escape');

    await expect(card(page, f.product.name).getByRole('button', { name: `Add ${f.product.name} to order` })).toBeVisible(
      { timeout: 30_000 },
    );
  });
});

test.describe('§9.10 — the customization sheet cannot be used to get around the block', () => {
  test('Details on a blocked item opens a sheet with the reason and NO add', async ({ page }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;

    await seedChannel(page, f.blockedOn);
    await gotoMenu(page);
    await card(page, f.product.name).getByRole('button', { name: 'Details' }).click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByText(f.expectedChipText)).toBeVisible();
    // Before this guard, THIS button was the two-click way around a blocked card.
    await expect(sheet.getByRole('button', { name: /^Add to Order/ })).toHaveCount(0);
    // The quantity stepper goes too — a quantity for something unorderable is noise.
    await expect(sheet.getByRole('button', { name: 'Increase quantity' })).toHaveCount(0);
  });

  test('switching from the sheet CLOSES it — its verdict was taken at open time', async ({ page }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;
    test.skip(f.orderableOn.length === 0, 'no switch target');

    await seedChannel(page, f.blockedOn);
    await gotoMenu(page);
    await card(page, f.product.name).getByRole('button', { name: 'Details' }).click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await sheet.getByRole('button', { name: `Switch to ${CHANNEL_LABEL[f.orderableOn[0]]}` }).click();

    // Leaving it open re-labelled the footer to a third channel and never restored Add.
    await expect(sheet.getByText(f.expectedChipText)).toBeHidden({ timeout: 20_000 });
  });
});

test.describe('the server is the backstop, whatever the client renders', () => {
  const apiBase = () => process.env.E2E_API_BASE_URL ?? 'http://localhost:5221';
  // The header is validated as a UUID. A non-UUID answers 400 too — one of the several 400s that
  // must never be mistaken for the channel rejection, which is exactly why the client gates on the
  // error CODE and why this test asserts the code rather than the status.
  const session = () => ({ 'X-Session-Id': crypto.randomUUID() });

  test('switching channel is a TWO-PHASE switch: phase one reports and mutates nothing', async ({ request }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;
    const headers = session();

    await request.post(`${apiBase()}/api/Basket/items`, { headers, data: { productId: f.product.id, quantity: 1 } });

    // No `removeConflicts` ⇒ dry run. It must REPORT the offending line…
    const dry = await request.put(`${apiBase()}/api/Basket/order-type`, { headers, data: { orderType: f.blockedOn } });
    expect(dry.status()).toBe(200);
    const conflicts = (await dry.json())?.data?.conflicts ?? [];
    expect(conflicts.map((c: { productId: string }) => c.productId)).toContain(f.product.id);

    // …and change nothing, so the same add is still permitted. A client that has not learned the
    // field gets a dry run, never a destructive one.
    const stillOk = await request.post(`${apiBase()}/api/Basket/items`, {
      headers,
      data: { productId: f.product.id, quantity: 1 },
    });
    expect(stillOk.status()).toBe(200);
  });

  test('once the switch is APPLIED, the add is refused with the OrderTypeNotAvailable code', async ({ request }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;
    const headers = session();

    // A basket must exist before its channel can be set — the endpoint 404s otherwise.
    await request.post(`${apiBase()}/api/Basket/items`, { headers, data: { productId: f.product.id, quantity: 1 } });
    const applied = await request.put(`${apiBase()}/api/Basket/order-type`, {
      headers,
      data: { orderType: f.blockedOn, removeConflicts: true },
    });
    expect(applied.status()).toBe(200);

    const res = await request.post(`${apiBase()}/api/Basket/items`, {
      headers,
      data: { productId: f.product.id, quantity: 1 },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe('OrderTypeNotAvailable');
    // The message is written FOR a guest — this is the one add-failure string shown verbatim.
    expect(body.message).toContain(f.product.name);
  });

  test('a channel-less basket is permissive by design — no channel, no enforcement', async ({ request }) => {
    test.skip(!fixture, 'no blocked fixture');
    const f = fixture as BlockedFixture;

    const res = await request.post(`${apiBase()}/api/Basket/items`, {
      headers: session(),
      data: { productId: f.product.id, quantity: 1 },
    });

    // The dominant browse state. Blocking here would refuse every guest who has chosen nothing.
    expect(res.status()).toBe(200);
  });
});

test.describe('environment reality check', () => {
  test('the enabled-channel list and a blocked fixture are both discoverable', async () => {
    expect(enabled.length).toBeGreaterThan(0);
    test.info().annotations.push({
      type: 'fixture',
      description: fixture
        ? `enabled=[${enabled}] blocked "${fixture.product.name}" on ${fixture.blockedOn}, orderable on [${fixture.orderableOn}] → chip "${fixture.expectedChipText}"`
        : `enabled=[${enabled}] — NO product is blocked on an enabled channel; the UI scenarios skipped`,
    });
  });
});

/** Escape a literal for use inside a RegExp. */
function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
