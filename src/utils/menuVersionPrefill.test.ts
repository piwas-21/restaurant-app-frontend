import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import { buildQuickMenuVersionPrefill } from './quickMenuVersionPayload';
import {
  consumeMenuVersionPrefill,
  MENU_VERSION_PREFILL_STORAGE_KEY,
  productFromMenuVersionPrefill,
  writeMenuVersionPrefill,
} from './menuVersionPrefill';

const source: ProductDetails = {
  id: 'product-1',
  name: 'Tacos 1 Viande',
  description: 'Tacos',
  basePrice: 9,
  isActive: true,
  isAvailable: true,
  preparationTimeMinutes: 8,
  type: 'mainItem',
  ingredients: [],
  allergens: ['gluten'],
  categories: [{ categoryId: 'cat-1', categoryName: 'Tacos', isPrimary: true }],
  primaryCategory: { id: 'cat-1', name: 'Tacos' },
  availableOrderTypes: 3,
  variations: [{ id: 'variation-1', name: 'Large', priceModifier: 2, finalPrice: 11, isActive: true }],
  images: [],
  suggestedSideItems: [],
  content: { fr: { name: 'Tacos 1 Viande', description: 'Tacos' } },
};

describe('menu version prefill', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('carries relation, source variation, categories, channel mask and localized section into the editor', () => {
    const prefill = buildQuickMenuVersionPrefill(source, 'Menu Tacos', 13, source.variations[0], 'Principal');

    expect(prefill).toMatchObject({
      name: 'Menu Tacos',
      basePrice: 13,
      categories: source.categories,
      primaryCategory: source.primaryCategory,
      availableOrderTypes: 3,
    });
    expect(prefill.menuDefinition).toMatchObject({
      parentOfferProductId: 'product-1',
      parentOfferVariationId: 'variation-1',
    });
    expect(prefill.menuDefinition.sections[0]).toMatchObject({ name: 'Principal' });
    expect(prefill.menuDefinition.sections[0].items[0]).toMatchObject({
      productId: 'product-1',
      productVariationId: 'variation-1',
    });
  });

  it('round-trips one-shot session state into a full bundle product without creating a record', () => {
    const prefill = buildQuickMenuVersionPrefill(source, 'Renamed menu', 14, undefined, 'Main');
    writeMenuVersionPrefill(prefill);

    const consumed = consumeMenuVersionPrefill();
    expect(consumed?.name).toBe('Renamed menu');
    expect(window.sessionStorage.getItem(MENU_VERSION_PREFILL_STORAGE_KEY)).toBeNull();
    if (!consumed) throw new Error('Expected a stored prefill');
    expect(productFromMenuVersionPrefill(consumed)).toMatchObject({
      id: '',
      name: 'Renamed menu',
      isActive: true,
      isAvailable: true,
      categories: source.categories,
    });
    expect(productFromMenuVersionPrefill(consumed).menuDefinition).toMatchObject({
      parentOfferProductId: 'product-1',
      sections: [{ name: 'Main' }],
    });
  });

  it('rejects a corrupted nested id before consuming the handoff', () => {
    const prefill = buildQuickMenuVersionPrefill(source, 'Broken menu', 14, undefined, 'Main');
    const corrupted = {
      nonce: 'nonce-1',
      expiresAt: Date.now() + 60_000,
      prefill: {
        ...prefill,
        menuDefinition: {
          ...prefill.menuDefinition,
          sections: [
            {
              ...prefill.menuDefinition.sections[0],
              items: [{ ...prefill.menuDefinition.sections[0].items[0], productId: '' }],
            },
          ],
        },
      },
    };
    window.sessionStorage.setItem(MENU_VERSION_PREFILL_STORAGE_KEY, JSON.stringify(corrupted));

    expect(consumeMenuVersionPrefill()).toBeNull();
    expect(window.sessionStorage.getItem(MENU_VERSION_PREFILL_STORAGE_KEY)).not.toBeNull();
  });

  it('rejects an expired or non-bundle envelope without opening a standalone draft', () => {
    const prefill = buildQuickMenuVersionPrefill(source, 'Expired menu', 14, undefined, 'Main');
    window.sessionStorage.setItem(
      MENU_VERSION_PREFILL_STORAGE_KEY,
      JSON.stringify({ nonce: 'nonce-1', expiresAt: Date.now() - 1, prefill }),
    );
    expect(consumeMenuVersionPrefill()).toBeNull();

    window.sessionStorage.setItem(
      MENU_VERSION_PREFILL_STORAGE_KEY,
      JSON.stringify({
        nonce: 'nonce-2',
        expiresAt: Date.now() + 60_000,
        prefill: { ...prefill, isBundle: false },
      }),
    );
    expect(consumeMenuVersionPrefill()).toBeNull();
  });
});
