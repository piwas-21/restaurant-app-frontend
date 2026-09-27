import { act, renderHook } from '@testing-library/react';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import { buildTranslationSlots } from '@/components/admin/product-editor/translations/translationSlots';
import type { useProductEditorForm } from './useProductEditorForm';
import { useEditorSourceLocales } from './useEditorSourceLocales';

describe('useEditorSourceLocales row identity', () => {
  it('keeps choices and persisted locale metadata with their rows after reorder and removal', () => {
    const product = {
      id: 'product-1',
      variations: [
        { id: 'variation-small', translationMetadata: { sourceLocales: { name: 'fr' } } },
        { id: 'variation-large', translationMetadata: { sourceLocales: { name: 'de' } } },
      ],
      detailedIngredients: [
        { id: 'ingredient-cheese', translationMetadata: { sourceLocales: { name: 'it' } } },
        { id: 'ingredient-olives', translationMetadata: { sourceLocales: { name: 'nl' } } },
      ],
    } as unknown as ProductDetails;
    const editor = {
      currentLanguage: 'en',
      menuDefinition: { sections: [] },
    } as unknown as ReturnType<typeof useProductEditorForm>;
    const { result } = renderHook(() => useEditorSourceLocales({ editor, product, productId: product.id }));

    const before = buildTranslationSlots({
      variations: [
        { id: 'variation-large', clientKey: 'field-large', name: 'Large' }, // pragma: allowlist secret -- synthetic RHF identity
        { id: 'variation-small', clientKey: 'field-small', name: 'Small' }, // pragma: allowlist secret -- synthetic RHF identity
      ],
      ingredients: [
        { id: 'ingredient-olives', name: 'Olives' },
        { id: 'ingredient-cheese', name: 'Cheese' },
      ],
    });
    const large = before.find((slot) => slot.source === 'Large');
    const cheese = before.find((slot) => slot.source === 'Cheese');
    expect(large).toBeDefined();
    expect(cheese).toBeDefined();
    expect(result.current.sourceLocaleFor(large!.key, large)).toBe('de');
    expect(result.current.sourceLocaleFor(cheese!.key, cheese)).toBe('it');

    act(() => result.current.setSourceLocaleFor(large!.key, 'zh'));

    const afterRemoval = buildTranslationSlots({
      variations: [{ id: 'variation-large', clientKey: 'field-large', name: 'Large' }], // pragma: allowlist secret -- synthetic RHF identity
      ingredients: [{ id: 'ingredient-cheese', name: 'Cheese' }],
    });
    const remainingLarge = afterRemoval.find((slot) => slot.source === 'Large');
    const remainingCheese = afterRemoval.find((slot) => slot.source === 'Cheese');
    expect(remainingLarge).toBeDefined();
    expect(remainingCheese).toBeDefined();
    expect(result.current.sourceLocaleFor(remainingLarge!.key, remainingLarge)).toBe('zh');
    expect(result.current.sourceLocaleFor(remainingCheese!.key, remainingCheese)).toBe('it');
  });
});
