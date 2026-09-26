import {
  createProductFormSchema,
  createProductSchema,
  editProductSchema,
  QUICK_ADD_ITEM_FIELDS,
  quickAddItemFormSchema,
  quickAddItemSchema,
} from './schemas';
import { buildQuickAddItemPayload } from '@/utils/quickAddItemPayload';
import { emptyProductDetails, toItemDefaults } from '@/utils/productEditorDefaults';

/**
 * D3's guard rail, asserted rather than promised: **the quick-add modal is a strict subset of the
 * full editor — no field may exist in one and not the other.**
 *
 * The plan takes it from Clover's split-brain complaint ("ON BULK EDIT AND EDIT YOU CANNOT CHANGE
 * COST"): a second create surface that validates a field differently, or forgets one, re-creates
 * exactly the divergence S3 exists to delete. Two halves have to hold, and each has its own trap:
 *
 * 1. every field the modal DOES ask for is the create schema's own validator — not a copy that can
 *    drift in bound, coercion or message. `.pick()` reuses the instance, so identity is the test;
 * 2. every field the modal does NOT ask for is still SENT (plan §6 — a field a write path omits is
 *    a column that write path clears), with the values the create route's own defaults carry.
 */
describe('quick-add is a strict subset of the full create form (D3)', () => {
  const quickAddKeys = Object.keys(quickAddItemSchema.shape);

  it('asks for name, price, category, and whether the item is internal', () => {
    expect(quickAddKeys.sort()).toEqual(['basePrice', 'categoryIds', 'isComponent', 'name', 'primaryCategoryId']);
    expect(Object.keys(QUICK_ADD_ITEM_FIELDS).sort()).toEqual(quickAddKeys.sort());
  });

  // Identity, not deep-equality: a structurally identical clone would pass a `toEqual` and still be
  // a second source of truth that the next bound change updates in one place only.
  it('reuses the create schema’s own validator for every field it shows', () => {
    const fullShape = createProductSchema.shape as Record<string, unknown>;
    for (const key of quickAddKeys) {
      expect(fullShape).toHaveProperty(key);
      expect((quickAddItemSchema.shape as Record<string, unknown>)[key]).toBe(fullShape[key]);
    }
  });

  it('rejects what the full form rejects, with the full form’s message', () => {
    const empty = { name: '', basePrice: -1, categoryIds: [], primaryCategoryId: '', isComponent: false };
    const quick = quickAddItemSchema.safeParse(empty);
    const full = createProductSchema.safeParse({ ...toItemDefaults(emptyProductDetails(false)), ...empty });

    expect(quick.success).toBe(false);
    expect(full.success).toBe(false);
    const messageFor = (issues: { path: PropertyKey[]; message: string }[], field: string) =>
      issues.find((issue) => issue.path[0] === field)?.message;
    for (const field of quickAddKeys) {
      expect(messageFor(quick.error!.issues, field)).toBe(messageFor(full.error!.issues, field));
    }
  });

  // The other half. `type`, `kitchenType`, `hideBaseProduct` and `availableOrderTypes` are columns
  // the create command assigns unconditionally: a payload that dropped one would write a row the
  // editor then has to repair, which is §6's trap applied to a POST.
  it('sends every field the modal does not ask for, from the create route’s own defaults', () => {
    const payload = buildQuickAddItemPayload({
      name: 'Margherita',
      basePrice: 14.5,
      categoryIds: ['cat-a'],
      primaryCategoryId: 'cat-a',
      isComponent: false,
    });

    // Every field of the create schema, named by the schema itself so a new column added there
    // fails HERE rather than silently going unsent. `menuDefinition` is a bundle's, and optional.
    const expected = Object.keys(createProductSchema.shape).filter((key) => key !== 'menuDefinition');
    expect(Object.keys(payload).sort()).toEqual(expected.sort());
    expect(payload).toMatchObject({
      name: 'Margherita',
      basePrice: 14.5,
      categoryIds: ['cat-a'],
      primaryCategoryId: 'cat-a',
      type: 'mainItem',
      kitchenType: 'None',
      isActive: true,
      isAvailable: true,
      isSpecial: false,
      hideBaseProduct: false,
      // A quick-added item is a NORMAL item (#631). If this ever seeded `true`, every item created
      // from the modal would be invisible on the guest menu with nothing on the modal to say so.
      isComponent: false,
      allergens: [],
      variations: [],
      content: [],
      suggestedSideItemIds: [],
      preparationTimeMinutes: 0,
      // `null` = inherit the primary category's channels, which is what a fresh item must mean.
      // A 0 here would be an item orderable nowhere, and the server refuses it.
      availableOrderTypes: null,
    });
  });

  // `displayOrder` is on the form defaults but not on the create schema. The parse is what strips
  // it — the same thing react-hook-form's resolver did on the route that used to exist.
  it('strips the keys the create schema does not carry', () => {
    expect(toItemDefaults(emptyProductDetails(false))).toHaveProperty('displayOrder');
    expect(
      buildQuickAddItemPayload({
        name: 'x',
        basePrice: 1,
        isComponent: false,
        categoryIds: ['c'],
        primaryCategoryId: 'c',
      }),
    ).not.toHaveProperty('displayOrder');
  });

  it('allows zero only for internal components in create, quick-add, and edit validation', () => {
    const component = {
      name: 'Bundle side',
      basePrice: 0,
      isComponent: true,
      categoryIds: ['cat-a'],
      primaryCategoryId: 'cat-a',
    };
    const sellable = { ...component, isComponent: false };

    expect(quickAddItemFormSchema.safeParse(component).success).toBe(true);
    expect(
      createProductFormSchema.safeParse({ ...toItemDefaults(emptyProductDetails(false)), ...component }).success,
    ).toBe(true);
    expect(quickAddItemFormSchema.safeParse(sellable).success).toBe(false);
    expect(
      createProductFormSchema.safeParse({ ...toItemDefaults(emptyProductDetails(false)), ...sellable }).success,
    ).toBe(false);

    const editValues = {
      ...toItemDefaults(emptyProductDetails(false)),
      ...component,
      categoryIds: ['cat-a'],
      primaryCategoryId: 'cat-a',
    };
    expect(editProductSchema.safeParse(editValues).success).toBe(true);
    expect(editProductSchema.safeParse({ ...editValues, isComponent: false }).success).toBe(false);
  });
});
