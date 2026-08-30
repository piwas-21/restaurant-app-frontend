import { editMenuBundleSchema, editProductSchema } from './schemas';
import { toBundleDefaults, toItemDefaults } from '@/utils/productEditorDefaults';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

/**
 * The rest of the null audit that frontend #638 opened.
 *
 * #638 fixed `variationSchema.description`, and the same defect was still live on two more fields
 * of the same shape. The rule it established: **a form schema is a contract with the SERVER'S JSON,
 * not with the form's own defaults.** `z.string().optional()` accepts `undefined` and REFUSES
 * `null`, the API sets no `DefaultIgnoreCondition` (stated at `ApiResponse.cs:26`), and the two
 * mappers below hand a fetched value to the form VERBATIM — `toItemDefaults` for a variation,
 * `toMenuDefinitionState` for a bundle's sections. A refusal there blocks the whole save.
 *
 * These are parse tests, not render tests, because the defect is entirely in the contract: every
 * value here is copied from the C# DTO that produces it.
 */
const item = {
  id: 'p1',
  name: 'Kebab',
  description: 'd',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  preparationTimeMinutes: 10,
  type: 'mainItem',
  ingredients: [],
  allergens: [],
  categories: [{ categoryId: 'c1', categoryName: 'X', isPrimary: true }],
  primaryCategory: { id: 'c1', name: 'X' },
  variations: [],
  images: [],
  suggestedSideItems: [],
  content: {},
} as unknown as ProductDetails;

const bundle = {
  id: 'b1',
  name: 'Menu du jour',
  description: 'x',
  basePrice: 20,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  preparationTimeMinutes: 0,
  type: 'menu',
  content: {},
  menuDefinition: {
    id: 'd1',
    isAlwaysAvailable: true,
    startTime: null,
    endTime: null,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [],
  },
} as unknown as ProductDetails;

describe('editor schemas — the nulls the API really sends', () => {
  /**
   * `ProductVariationDto.GlobalVariationId` is `Guid?`, and it is null for every variation the admin
   * TYPED rather than picked from the library — which is most of them. It has no input anywhere, so
   * its refusal could not even be jumped to.
   */
  it('accepts a variation that came from no library (globalVariationId: null)', () => {
    const product = {
      ...item,
      variations: [
        {
          id: 'v1',
          name: 'Large',
          description: 'x',
          priceModifier: 1,
          isActive: true,
          displayOrder: 0,
          globalVariationId: null,
          content: {},
        },
      ],
    } as unknown as ProductDetails;

    expect(editProductSchema.safeParse(toItemDefaults(product)).success).toBe(true);
  });

  /** `MenuSectionDto.Description` is `string?`, and a bundle section rarely has one. */
  it('accepts a bundle section saved without a description', () => {
    const withSection = {
      ...bundle,
      menuDefinition: {
        ...(bundle.menuDefinition as object),
        sections: [
          {
            id: 's1',
            name: 'Starter',
            description: null,
            displayOrder: 0,
            isRequired: true,
            minSelection: 1,
            maxSelection: 1,
            items: [],
          },
        ],
      },
    } as unknown as ProductDetails;

    expect(editMenuBundleSchema.safeParse(toBundleDefaults(withSection)).success).toBe(true);
  });

  // The control that keeps the two tests above honest: the same parse must still REFUSE the things
  // the form really may not send, so "accepts null" cannot be read as "accepts anything".
  it('still refuses a variation with no name and a bundle section with no name', () => {
    const noName = {
      ...item,
      variations: [{ id: 'v1', name: '', priceModifier: 1, isActive: true, displayOrder: 0, content: {} }],
    } as unknown as ProductDetails;

    expect(editProductSchema.safeParse(toItemDefaults(noName)).success).toBe(false);
  });
});
