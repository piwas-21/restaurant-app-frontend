import { act, renderHook } from '@testing-library/react';
import { useBundleOptionTour } from './useBundleOptionTour';
import type { MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';

const option = (id: string): MenuSectionItem => ({
  id,
  productId: 'burger',
  productName: 'Burger',
  additionalPrice: 0,
  displayOrder: 1,
  isDefault: true,
  detailedIngredients: [
    {
      id: 'cheese',
      name: 'Cheese',
      price: 2,
      isOptional: true,
      isIncludedInBasePrice: false,
      isActive: true,
      displayOrder: 1,
      maxQuantity: 1,
    },
  ],
});

const section = (...items: MenuSectionItem[]): MenuSection => ({
  id: 'main',
  name: 'Main',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 2,
  items,
});

describe('useBundleOptionTour legacy selection lookup', () => {
  it('opens the unique legacy option using its canonical row ID', () => {
    const main = section(option('row-a'));
    const selection: SelectedMenuOption = { sectionId: 'main', itemId: 'burger', quantity: 1 };
    const { result } = renderHook(() => useBundleOptionTour({ sections: [main], selectedOptions: [selection] }));

    act(() => {
      expect(result.current.begin(main)).toBe(true);
    });

    expect(result.current.customizingOption).toMatchObject({
      sectionId: 'main',
      itemId: 'burger',
      menuSectionItemId: 'row-a',
    });
  });

  it('does not begin a tour for an ambiguous legacy product-only selection', () => {
    const main = section(option('row-a'), option('row-b'));
    const selection: SelectedMenuOption = { sectionId: 'main', itemId: 'burger', quantity: 1 };
    const { result } = renderHook(() => useBundleOptionTour({ sections: [main], selectedOptions: [selection] }));

    act(() => {
      expect(result.current.begin(main)).toBe(false);
    });

    expect(result.current.customizingOption).toBeNull();
  });
});
