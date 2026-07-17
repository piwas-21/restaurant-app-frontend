import {
  EMPTY_MENU_DEFINITION,
  flattenContent,
  resolveCategoryIds,
  resolvePrimaryCategoryId,
  resolveSideItemIds,
  toBundleDefaults,
  toItemDefaults,
  toMenuDefinitionState,
} from './productEditorDefaults';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

const CAT_A = 'cat-a';
const CAT_B = 'cat-b';

const product = (overrides: Partial<ProductDetails> = {}): ProductDetails =>
  ({
    id: 'p1',
    name: 'Margherita',
    description: 'A pizza',
    basePrice: 12,
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    preparationTimeMinutes: 10,
    type: 'mainItem',
    ingredients: [],
    allergens: ['gluten'],
    categories: [
      { categoryId: CAT_A, categoryName: 'Pizza', isPrimary: false },
      { categoryId: CAT_B, categoryName: 'Specials', isPrimary: true },
    ],
    variations: [],
    images: [],
    suggestedSideItems: [],
    ...overrides,
  }) as ProductDetails;

describe('resolvePrimaryCategoryId', () => {
  // The bug this fixes: the modals read `product.primaryCategoryId`, which NO response DTO
  // carries — the API returns `primaryCategory` as an object. That read was always undefined,
  // so it always fell through to categoryIds[0]. Here the real primary is the SECOND category,
  // which is the only arrangement that can tell the two behaviours apart.
  it('prefers the primaryCategory object the API actually returns', () => {
    const p = product({ primaryCategory: { id: CAT_B, name: 'Specials' } });

    expect(resolvePrimaryCategoryId(p, [CAT_A, CAT_B])).toBe(CAT_B);
  });

  // Same divergence via the other real signal, for a payload without the primaryCategory object.
  it('falls back to the isPrimary flag on the category rows', () => {
    const p = product({ primaryCategory: undefined });

    expect(resolvePrimaryCategoryId(p, [CAT_A, CAT_B])).toBe(CAT_B);
  });

  // Only when the product genuinely has no primary is "first category" correct.
  it('falls back to the first category only when nothing is marked primary', () => {
    const p = product({
      primaryCategory: undefined,
      categories: [
        { categoryId: CAT_A, categoryName: 'Pizza', isPrimary: false },
        { categoryId: CAT_B, categoryName: 'Specials', isPrimary: false },
      ],
    });

    expect(resolvePrimaryCategoryId(p, [CAT_A, CAT_B])).toBe(CAT_A);
  });

  it('returns empty string when the product has no categories at all', () => {
    expect(resolvePrimaryCategoryId(product({ categories: [], primaryCategory: undefined }), [])).toBe('');
  });
});

describe('toItemDefaults / toBundleDefaults', () => {
  // The two kinds are validated by different schemas, so seeding the wrong shape makes the
  // form unsubmittable: editProductSchema requires categoryIds.min(1), which a bundle can
  // never satisfy, and editMenuBundleSchema requires a menuDefinition and declares no
  // category field.
  it('seeds an item with the fields editProductSchema requires', () => {
    const defaults = toItemDefaults(product({ primaryCategory: { id: CAT_B, name: 'Specials' } })) as Record<
      string,
      unknown
    >;

    expect(defaults.categoryIds).toEqual([CAT_A, CAT_B]);
    expect(defaults.primaryCategoryId).toBe(CAT_B);
    expect(defaults.type).toBe('mainItem');
    expect(defaults.allergens).toEqual(['gluten']);
  });

  it('seeds a bundle with no category fields at all', () => {
    const defaults = toBundleDefaults(product({ type: 'menu' })) as Record<string, unknown>;

    expect(defaults.type).toBe('menu');
    expect(defaults).not.toHaveProperty('categoryIds');
    expect(defaults).not.toHaveProperty('primaryCategoryId');
    expect(defaults).not.toHaveProperty('variations');
    expect(defaults).not.toHaveProperty('suggestedSideItemIds');
    expect(defaults.id).toBe('p1');
  });
});

describe('flattenContent', () => {
  it('turns the language map into the rows useFieldArray renders', () => {
    expect(flattenContent({ en: { name: 'Pizza', description: 'Cheesy' } })).toEqual([
      { language: 'en', name: 'Pizza', description: 'Cheesy' },
    ]);
  });

  it('tolerates a missing content map', () => {
    expect(flattenContent(undefined)).toEqual([]);
  });
});

describe('resolveCategoryIds / resolveSideItemIds', () => {
  it('reads categoryId off each row', () => {
    expect(resolveCategoryIds(product())).toEqual([CAT_A, CAT_B]);
  });

  it('drops rows with no id rather than emitting undefined', () => {
    const p = product({
      categories: [
        { categoryId: '', categoryName: 'Broken', isPrimary: false },
        { categoryId: CAT_A, categoryName: 'Pizza', isPrimary: false },
      ],
    });

    expect(resolveCategoryIds(p)).toEqual([CAT_A]);
  });

  it('extracts suggested side item ids', () => {
    const p = product({ suggestedSideItems: [{ id: 's1' }, { id: 's2' }] as ProductDetails['suggestedSideItems'] });

    expect(resolveSideItemIds(p)).toEqual(['s1', 's2']);
  });
});

describe('toMenuDefinitionState', () => {
  it('returns an editable empty definition when the bundle has none saved', () => {
    expect(toMenuDefinitionState(product({ menuDefinition: undefined }))).toEqual(EMPTY_MENU_DEFINITION);
  });

  it('keeps the saved definition, defaulting the day flags it omits', () => {
    const p = product({
      menuDefinition: { ...EMPTY_MENU_DEFINITION, id: 'md-1', isAlwaysAvailable: false },
    });

    const state = toMenuDefinitionState(p);
    expect(state.id).toBe('md-1');
    expect(state.isAlwaysAvailable).toBe(false);
    expect(state.availableMonday).toBe(true);
    expect(state.sections).toEqual([]);
  });
});
