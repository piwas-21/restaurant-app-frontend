import { act, renderHook } from '@testing-library/react';
import { buildMixedBundleSteps } from '@/utils/customerStepPlanner.bundle';
import type { SheetController } from './useSheetFlow';
import { useReviewRows } from './useReviewRows';
import { useSheetFlow } from './useSheetFlow';
import type { MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const burger = (id: string): MenuSectionItem => ({
  id,
  productId: 'burger',
  productName: 'Burger',
  additionalPrice: 0,
  displayOrder: 1,
  isDefault: true,
  hideBaseProduct: true,
  sauceMin: 0,
  sauceMax: 1,
  sauceIncludedFree: 1,
  variations: [
    { id: 'regular', name: 'Regular', priceModifier: 0, finalPrice: 18, isActive: true, displayOrder: 1 },
    { id: 'large', name: 'Large', priceModifier: 2, finalPrice: 20, isActive: true, displayOrder: 2 },
  ],
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
    {
      id: 'ketchup',
      name: 'Ketchup',
      price: 0,
      isOptional: true,
      isIncludedInBasePrice: true,
      isActive: true,
      displayOrder: 2,
      maxQuantity: 1,
      kind: 'sauce',
    },
  ],
});

const menuSection = (id: string, items: MenuSectionItem[]): MenuSection => ({
  id,
  name: id,
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items,
});

const controller = (sections: MenuSection[], selectedOptions: SelectedMenuOption[]) =>
  ({
    sections,
    selectedOptions,
    kind: 'bundle',
    currentLanguage: 'en',
    linePrice: { total: 18 },
  }) as unknown as SheetController;

describe('bundle review legacy selection recovery', () => {
  it('shows the actual variation, sauce, and ingredient for a uniquely resolvable pre-release selection', () => {
    const sections = [menuSection('main', [burger('row-a')])];
    const draft: SelectedMenuOption = {
      sectionId: 'main',
      itemId: 'burger',
      quantity: 1,
      componentProductVariationId: 'large',
      selectedIngredients: ['cheese', 'ketchup'],
      ingredientQuantities: { cheese: 1, ketchup: 1 },
    };
    const steps = buildMixedBundleSteps(sections, undefined, [draft]);
    const { result } = renderHook(() => useReviewRows({ controller: controller(sections, [draft]), steps }));

    expect(result.current.find((row) => row.step.kind === 'variations')?.values).toEqual(['Large']);
    expect(result.current.find((row) => row.step.kind === 'sauces')?.values).toEqual(['Ketchup']);
    expect(result.current.find((row) => row.step.kind === 'ingredients')?.values).toEqual(['Cheese']);
    expect(draft).not.toHaveProperty('menuSectionItemId');
  });

  it('puts an ambiguity warning on the section review row when duplicate catalogue rows match', () => {
    const sections = [
      menuSection('main', [burger('row-a'), burger('row-b')]),
      menuSection('drinks', [
        {
          id: 'water-row',
          productId: 'water',
          productName: 'Water',
          additionalPrice: 0,
          displayOrder: 1,
          isDefault: true,
        },
      ]),
    ];
    const draft: SelectedMenuOption = {
      sectionId: 'main',
      itemId: 'burger',
      quantity: 1,
      selectedIngredients: ['cheese'],
    };
    const steps = buildMixedBundleSteps(sections, undefined, [draft]);
    const { result } = renderHook(() => useReviewRows({ controller: controller(sections, [draft]), steps }));
    const row = result.current.find((entry) => entry.step.section?.id === 'main');

    expect(row?.warning).toBe('customer_selection_recover');
    expect(row?.step.selectionRecovery).toBe(true);
    expect(steps.some((step) => step.sectionItemId === 'row-a' || step.sectionItemId === 'row-b')).toBe(false);
  });

  it('returns to the recovery section and refuses the terminal add while an ambiguous draft remains', () => {
    const sections = [
      menuSection('main', [burger('row-a'), burger('row-b')]),
      menuSection('drinks', [
        {
          id: 'water-row',
          productId: 'water',
          productName: 'Water',
          additionalPrice: 0,
          displayOrder: 1,
          isDefault: true,
        },
      ]),
    ];
    const draft: SelectedMenuOption = { sectionId: 'main', itemId: 'burger', quantity: 1 };
    const selections = [draft, { sectionId: 'drinks', itemId: 'water', menuSectionItemId: 'water-row', quantity: 1 }];
    const commit = jest.fn();
    const { result } = renderHook(() => useSheetFlow(controller(sections, selections)));

    act(() => result.current.goNext());
    act(() => result.current.goNext());
    expect(result.current.step?.kind).toBe('review');

    act(() => result.current.addOrJumpToBlocker(commit));

    expect(commit).not.toHaveBeenCalled();
    expect(result.current.step?.section?.id).toBe('main');
    expect(result.current.step?.selectionRecovery).toBe(true);
  });
});
