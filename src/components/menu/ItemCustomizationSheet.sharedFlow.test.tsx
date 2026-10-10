import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ItemCustomizationSheet from './ItemCustomizationSheet';
import { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';
import type { DetailedIngredient, MenuBundleItem, MenuSection, ProductCustomizationGroup } from '@/types/menu';

const mockAddItem = jest.fn().mockResolvedValue(undefined);

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({ addItem: mockAddItem }),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));
jest.mock('@/hooks/menu/useItemAvailabilityNotice', () => ({
  useItemAvailabilityNotice: jest.fn(() => null),
}));

const ingredient = (id: string, extra: Partial<DetailedIngredient> = {}): DetailedIngredient => ({
  id,
  name: id,
  price: 0,
  isOptional: true,
  isIncludedInBasePrice: false,
  isActive: true,
  displayOrder: 1,
  maxQuantity: 1,
  ...extra,
});

const burgerSection: MenuSection = {
  id: 'main',
  name: 'Main',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [
    {
      id: 'si-burger',
      productId: 'burger',
      productName: 'Burger',
      additionalPrice: 4,
      displayOrder: 1,
      isDefault: true,
      detailedIngredients: [
        ingredient('onion', { isOptional: false, isIncludedInBasePrice: true }),
        ingredient('salsa', { kind: 'sauce', price: 1.5 }),
        ingredient('bacon', { price: 3 }),
      ],
      sauceMin: 0,
      sauceMax: 2,
      sauceIncludedFree: 0,
    },
    { id: 'si-wrap', productId: 'wrap', productName: 'Wrap', additionalPrice: 0, displayOrder: 2, isDefault: false },
  ],
};

const drinkSection: MenuSection = {
  id: 'drink',
  name: 'Drink',
  displayOrder: 2,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [
    { id: 'si-coke', productId: 'coke', productName: 'Coke', additionalPrice: 0, displayOrder: 1, isDefault: true },
    { id: 'si-water', productId: 'water', productName: 'Water', additionalPrice: 1, displayOrder: 2, isDefault: false },
  ],
};

const requiredMeatGroup: ProductCustomizationGroup = {
  id: 'meat-choice',
  name: 'Meat',
  displayOrder: 0,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  includedFreeUnits: 0,
  isActive: true,
  content: {},
  ingredientOptions: [],
  productOptions: [
    {
      id: 'chicken-option',
      optionProductId: 'chicken',
      optionProductName: 'Chicken',
      additionalPrice: 3,
      displayOrder: 0,
      isDefault: false,
    },
  ],
};

const bundle: MenuBundleItem = {
  id: 'combo',
  name: 'Lunch Combo',
  content: { en: { name: 'Lunch Combo', description: '' } },
  basePrice: 20,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  displayOrder: 1,
  menuDefinition: {
    id: 'md',
    isAlwaysAvailable: true,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [burgerSection, drinkSection],
  },
};

const requiredGroupBundle: MenuBundleItem = {
  ...bundle,
  menuDefinition: {
    ...bundle.menuDefinition!,
    sections: [
      { ...burgerSection, items: [{ ...burgerSection.items[0], customizationGroups: [requiredMeatGroup] }] },
      drinkSection,
    ],
  },
};

const requiredSauceBundle: MenuBundleItem = {
  ...bundle,
  menuDefinition: {
    ...bundle.menuDefinition!,
    sections: [{ ...burgerSection, items: [{ ...burgerSection.items[0], sauceMin: 1, sauceMax: 2 }] }, drinkSection],
  },
};

const harness = { controller: undefined as ReturnType<typeof useBundleCustomizationSheet> | undefined };

function Harness() {
  const controller = useBundleCustomizationSheet({ onAdded: jest.fn(), onLineAdded: jest.fn() });
  harness.controller = controller;
  return <ItemCustomizationSheet controller={controller} />;
}

async function openSheet(target = bundle) {
  render(<Harness />);
  await act(async () => harness.controller?.openForBundle(target));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
}

describe('bundle customization uses one shared mixed flow', () => {
  beforeEach(() => {
    mockAddItem.mockClear();
    harness.controller = undefined;
  });

  it('jumps to the selected component screen and keeps its stable selection through back and revisit', async () => {
    await openSheet();
    expect(harness.controller?.selectedOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionId: 'main', menuSectionItemId: 'si-burger', itemId: 'burger' }),
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: 'customer_cta_customize_item' }));
    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: /bacon/ }));

    const selectedBurger = harness.controller?.selectedOptions.find(
      (option) => option.menuSectionItemId === 'si-burger',
    );
    expect(selectedBurger?.selectedIngredients).toContain('bacon');
    expect(screen.getAllByText(/27[.,]00/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'step_back' }));
    fireEvent.click(screen.getByRole('button', { name: 'step_back' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: /Burger/ })).toBeChecked());
    expect(
      harness.controller?.selectedOptions.find((option) => option.menuSectionItemId === 'si-burger')
        ?.selectedIngredients,
    ).toContain('bacon');

    fireEvent.click(screen.getByRole('button', { name: 'customer_cta_customize_item' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /bacon/ })).toBeChecked());
    expect(screen.getAllByText(/27[.,]00/).length).toBeGreaterThan(0);
  });

  it('does not add a partial bundle while the guest is still on a customization screen', async () => {
    await openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'customer_cta_customize_item' }));
    await waitFor(() => expect(screen.getByText('customize_ingredients')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'step_skip_ingredients' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('blocks a required component group until its choice is selected, then commits only at final Add', async () => {
    await openSheet(requiredGroupBundle);
    fireEvent.click(screen.getByRole('button', { name: 'customer_cta_customize_item' }));
    const chicken = await screen.findByRole('radio', { name: /Chicken/ });

    fireEvent.click(screen.getByRole('button', { name: 'customer_cta_next_step' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('step_blocked_group');
    expect(mockAddItem).not.toHaveBeenCalled();

    fireEvent.click(chicken);
    await waitFor(() => expect(screen.getByText('product_special_requests')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'step_skip' }));
    await waitFor(() => expect(screen.getByText('step_review_menu')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /customer_cta_add_to_basket/ }));

    await waitFor(() => expect(mockAddItem).toHaveBeenCalledTimes(1));
    expect(mockAddItem.mock.calls[0][0].selectedMenuOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          menuSectionItemId: 'si-burger',
          customizationSelections: [
            { groupId: 'meat-choice', options: [{ kind: 1, optionId: 'chicken-option', quantity: 1 }] },
          ],
        }),
      ]),
    );
  });

  it('blocks the component sauce minimum until a sauce is chosen, then reaches final Add', async () => {
    await openSheet(requiredSauceBundle);
    fireEvent.click(screen.getByRole('button', { name: 'customer_cta_customize_item' }));
    await screen.findByText('customize_ingredients');
    fireEvent.click(screen.getByRole('button', { name: 'step_skip_ingredients' }));
    await screen.findByText('sauces');

    fireEvent.click(screen.getByRole('button', { name: 'customer_cta_next_step' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('step_blocked_sauces');
    expect(mockAddItem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /salsa/i }));
    fireEvent.click(screen.getByRole('button', { name: 'customer_cta_next_step' }));
    await waitFor(() => expect(screen.getByText('product_special_requests')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'step_skip' }));
    await waitFor(() => expect(screen.getByText('step_review_menu')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /customer_cta_add_to_basket/ }));

    await waitFor(() => expect(mockAddItem).toHaveBeenCalledTimes(1));
    expect(mockAddItem.mock.calls[0][0].selectedMenuOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          menuSectionItemId: 'si-burger',
          selectedIngredients: expect.arrayContaining(['salsa']),
        }),
      ]),
    );
  });
});
