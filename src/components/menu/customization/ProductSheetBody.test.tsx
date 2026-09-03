import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ProductSheetBody from './ProductSheetBody';
import type { CustomizationStep } from '@/utils/customizationSteps';
import type { ProductSheetController } from './ProductSheetBody';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const sideItems = [
  { id: 'cola', name: 'Cola', price: 2, isRequired: false, displayOrder: 1, type: 'beverage' as const },
  { id: 'baklava', name: 'Baklava', price: 3, isRequired: false, displayOrder: 2, type: 'dessert' as const },
];

const controller = {
  kind: 'product',
  product: { id: 'p1', name: 'Dürüm', basePrice: 10, suggestedSideItems: sideItems },
  title: 'Dürüm',
  currentLanguage: 'en',
  selectedVariationId: null,
  setSelectedVariationId: jest.fn(),
  selectedIngredients: [],
  setSelectedIngredients: jest.fn(),
  ingredientQuantities: {},
  setIngredientQuantities: jest.fn(),
  selectedSideItems: [],
  setSelectedSideItems: jest.fn(),
} as unknown as ProductSheetController;

const sidesStep = (sideGroup?: string): CustomizationStep =>
  ({
    id: `sides:${sideGroup ?? 'all'}`,
    kind: 'sides',
    singleChoice: false,
    isRequired: false,
    sideGroup,
  }) as CustomizationStep;

describe('ProductSheetBody — the sides step', () => {
  /**
   * The wiring a section-level test cannot see. `SuggestedSideItemsSection` was already covered for
   * `onlyGroup`, and a mutant that passed `undefined` from HERE left every one of those tests green.
   */
  it('renders only the step’s own partition, without repeating its name', () => {
    render(<ProductSheetBody controller={controller} step={sidesStep('desserts')} onChoice={jest.fn()} />);

    expect(screen.getByText('Baklava')).toBeInTheDocument();
    expect(screen.queryByText('Cola')).not.toBeInTheDocument();
    // The step panel's own heading names the partition; a second <h3> under it said it twice.
    expect(screen.queryByRole('heading', { name: /suggested_side_group_desserts/ })).not.toBeInTheDocument();
  });

  /**
   * `sideGroup` is optional on the step type, and `bare` is what would turn a missing one into
   * three unlabelled lists. The variant is derived from the same field so the worst case is
   * develop's own screen — every partition, each named.
   */
  it('falls back to every partition WITH its heading when the step carries no group', () => {
    render(<ProductSheetBody controller={controller} step={sidesStep()} onChoice={jest.fn()} />);

    expect(screen.getByText('Cola')).toBeInTheDocument();
    expect(screen.getByText('Baklava')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /suggested_side_group_beverages/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /suggested_side_group_desserts/ })).toBeInTheDocument();
  });
});
