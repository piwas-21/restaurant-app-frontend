import { toBundleDefaults } from './productEditorDefaults';
import { createMenuBundleSchema } from '@/components/admin/product/schemas';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

/**
 * Backend #478 — a bundle's allergens had no write path, and adding one naively WIPES them.
 *
 * The trap is that `productFormUtils` puts `allergens` into every bundle PUT already. So the
 * moment the server starts reading that field, a save of anything else — a rename, a price
 * change — sends whatever the form happens to hold. If the form never seeded the stored value,
 * that is `[]`, and the labelling is gone.
 *
 * For allergens that is a SAFETY regression, not a lost preference: `useMenuFilters` reads an
 * item with no tokens as free of everything, so a wiped combo is listed under "No gluten".
 *
 * Three links have to agree — form defaults, schema, payload — and the failure is silent in each
 * of them, so each is asserted rather than assumed.
 */

const bundle = (allergens?: string[]) =>
  ({
    id: 'b1',
    name: 'Menu Kebab',
    description: '',
    basePrice: 12,
    type: 'menu',
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    preparationTimeMinutes: 0,
    displayOrder: 0,
    content: {},
    allergens,
    menuDefinition: { isAlwaysAvailable: true, sections: [] },
  }) as unknown as ProductDetails;

describe('a bundle save that never touches allergens keeps them', () => {
  it('seeds the STORED labels into the form, not an empty list', () => {
    // THE defect. Without this the untouched form re-submits `[]` and wipes them.
    expect(toBundleDefaults(bundle(['gluten', 'halal'])).allergens).toEqual(['gluten', 'halal']);
  });

  it('carries them through the schema instead of stripping them', () => {
    // zod strips unknown keys, so a field absent from the schema reaches the wire as nothing —
    // which `productFormUtils` then turns into `[]`. Being in the defaults is not enough.
    const parsed = createMenuBundleSchema.parse({
      ...toBundleDefaults(bundle(['gluten'])),
      menuDefinition: { isAlwaysAvailable: true, sections: [] },
    });

    expect(parsed.allergens).toEqual(['gluten']);
  });

  describe('controls', () => {
    it('an unlabelled bundle still seeds an empty list, not undefined', () => {
      // The default has to be a real array: an uncontrolled→controlled flip is what the sibling
      // `availableOrderTypes` comment in this file's source warns about.
      expect(toBundleDefaults(bundle(undefined)).allergens).toEqual([]);
    });

    it('an explicitly cleared list still clears', () => {
      // The fix must not become "never write allergens". An admin who unticks every chip is
      // saying something, and `[]` is how they say it — which is exactly why the DEFAULT has to
      // echo the stored value, since the two are indistinguishable on the wire.
      expect(toBundleDefaults(bundle([])).allergens).toEqual([]);
    });
  });
});
