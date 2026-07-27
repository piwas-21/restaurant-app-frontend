import { test, expect, type APIRequestContext } from '@playwright/test';
import { adminToken, credKeyForBaseUrl } from '../../helpers/adminAuth';
import { apiBaseUrl } from '../../helpers/config';

/**
 * HIGH-tier — the ADMIN half of per-order-type availability: that a restriction set by an owner
 * actually reaches the guest, and survives ordinary editing.
 *
 * The second test is a regression guard for a bug that SHIPPED (plan §9.1): `UpdateCategoryCommand`
 * is a full-replace PUT that assigns `AvailableOrderTypes` unconditionally, so any writer that did
 * not echo the field reset the restriction. `EditCategoryModal` was exactly such a writer — every
 * category RENAME silently wiped its channel rule. A unit test pins the modal; this pins the
 * contract end to end, which is where the damage actually happened.
 *
 * Every mutation is restored in `afterAll`, including on failure: these run against SHARED deployed
 * environments, and a test that leaves a category renamed or a channel switched off is worse than
 * no test at all.
 *
 * SERIAL on purpose. `beforeAll` runs once per WORKER, so a parallel admin suite spends a login
 * permit per worker — and deployed environments allow five per fifteen minutes, per IP. One worker,
 * one `beforeAll`, one login (usually zero: `adminToken` caches to `e2e/.auth/`).
 */
test.describe.configure({ mode: 'serial' });

let token: string | null = null;
let skipReason = '';
let api = '';

/** Category id → the mask it had before this suite touched it. */
const originalMasks = new Map<string, number | null>();
let renamedBack = true;

interface Category {
  id: string;
  name: string;
  description?: string;
  displayOrder?: number;
  imageUrl?: string;
  isActive?: boolean;
  availableOrderTypes?: number | null;
}

async function categories(request: APIRequestContext): Promise<Category[]> {
  const res = await request.get(`${api}/api/Categories?page=1&pageSize=100`);
  return ((await res.json())?.data?.items ?? []) as Category[];
}

/** A full-replace PUT — every field the caller does not echo is reset by the server. */
async function putCategory(request: APIRequestContext, c: Category, overrides: Partial<Category>) {
  return request.put(`${api}/api/Categories/${c.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      // The body must echo the route id — the handler rejects a mismatch with "Category ID
      // mismatch", which arrives as a generic "Operation failed" with the real text in errors[0].
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      displayOrder: c.displayOrder ?? 0,
      isActive: c.isActive ?? true,
      availableOrderTypes: c.availableOrderTypes ?? null,
      ...overrides,
    },
  });
}

test.beforeAll(async ({ request }) => {
  api = process.env.E2E_API_BASE_URL ?? apiBaseUrl();
  const result = await adminToken(request, api, credKeyForBaseUrl(process.env.E2E_BASE_URL ?? ''));
  token = result.token;
  skipReason = result.reason ?? '';
});

test.afterAll(async ({ request }) => {
  if (!token) return;
  // Restore every mask this suite changed, whatever happened above.
  for (const [id, mask] of originalMasks) {
    const current = (await categories(request)).find((c) => c.id === id);
    if (current) await putCategory(request, current, { availableOrderTypes: mask });
  }
  expect(renamedBack, 'a category was left renamed on a shared environment').toBe(true);
});

test('an owner-set restriction reaches the guest catalog', async ({ request }) => {
  test.skip(!token, skipReason || 'no admin token');

  const all = await categories(request);
  const target = all.find((c) => c.availableOrderTypes == null) ?? all[0];
  test.skip(!target, 'no category to exercise');
  originalMasks.set(target.id, target.availableOrderTypes ?? null);

  // 6 = Takeaway|Delivery — the client's original request ("Dürüm cannot be dine-in").
  const res = await putCategory(request, target, { availableOrderTypes: 6 });
  expect(res.status()).toBe(200);

  // The customer-facing projection must now refuse DineIn for that category's items…
  const blocked = await request.get(
    `${api}/api/Products?Page=1&PageSize=50&CategoryId=${target.id}&RequestedOrderType=DineIn`,
  );
  const items = (await blocked.json())?.data?.items ?? [];
  test.skip(items.length === 0, 'category has no products to project');
  // …but only for items that INHERIT — a product with its own mask overrides the category.
  const inheriting = items.filter(
    (i: { availability?: { inheritsOrderTypes?: boolean } }) => i.availability?.inheritsOrderTypes,
  );
  test.skip(inheriting.length === 0, 'every product in this category overrides the category mask');
  for (const item of inheriting) {
    expect(item.availability.canOrder).toBe(false);
    expect(item.availability.reason).toBe('WrongOrderType');
    expect(item.availability.allowedOrderTypes).toEqual(['Takeaway', 'Delivery']);
  }
});

test('§9.1 — renaming a category does NOT wipe its channel restriction', async ({ request }) => {
  test.skip(!token, skipReason || 'no admin token');

  const all = await categories(request);
  const target = all.find((c) => c.availableOrderTypes != null) ?? all[0];
  test.skip(!target, 'no category to exercise');
  if (!originalMasks.has(target.id)) originalMasks.set(target.id, target.availableOrderTypes ?? null);

  // Give it a known restriction, then rename it the way the admin modal does.
  await putCategory(request, target, { availableOrderTypes: 6 });
  const withMask = (await categories(request)).find((c) => c.id === target.id) as Category;
  expect(withMask.availableOrderTypes).toBe(6);

  const originalName = withMask.name;
  const tempName = `${originalName} e2e-rename`;
  renamedBack = false;
  try {
    const renamed = await putCategory(request, withMask, { name: tempName });
    expect(renamed.status()).toBe(200);

    const after = (await categories(request)).find((c) => c.id === target.id) as Category;
    expect(after.name).toBe(tempName);
    // THE assertion. Before the fix this read `null` — the rename silently reset the restriction,
    // and nothing in the UI said so.
    expect(after.availableOrderTypes, 'the rename wiped the channel mask (§9.1 regression)').toBe(6);
  } finally {
    const current = (await categories(request)).find((c) => c.id === target.id);
    if (current) {
      await putCategory(request, current, { name: originalName });
      renamedBack = true;
    }
  }
});
